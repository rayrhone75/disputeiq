// Convex functions for the `mailJobs` + `mailJobEvents` tables.
//
// Owns: admin mail-job listing/detail, user-facing mail-job lookup, retry
// mutation (admin-only), webhook ingestion (secret-gated), cron sweep
// (secret-gated), and creation/event helpers used by the Next.js mail
// dispatcher.
//
// Auth model:
//   - Admin queries / mutations gate via `requireRole(ctx, ["OWNER", ...])`.
//   - User-facing queries gate via `requireUser(ctx)` + ownership check.
//   - Webhook + cron mutations are PUBLIC mutations gated by an explicit
//     `secret` argument the Next.js route extracts from env and forwards.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole, requireUser } from "./helpers";

const mailJobStatusValidator = v.union(
  v.literal("QUEUED"),
  v.literal("SUBMITTED"),
  v.literal("ACCEPTED"),
  v.literal("PRINTED"),
  v.literal("MAILED"),
  v.literal("DELIVERED"),
  v.literal("FAILED"),
);

const disputeStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("NEEDS_USER_CONFIRMATION"),
  v.literal("READY_FOR_PAYMENT"),
  v.literal("PAID"),
  v.literal("MAILED"),
  v.literal("DELIVERED"),
  v.literal("RESPONSE_RECEIVED"),
  v.literal("ESCALATION_READY"),
  v.literal("CLOSED"),
);

// --- Admin queries ---------------------------------------------------------

/**
 * Admin: list recent mail jobs joined with their dispute case + owner email.
 * Returns shape used by `/admin/mail-jobs/page.tsx`.
 */
export const listForAdmin = query({
  args: {
    status: v.optional(mailJobStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);

    const take = Math.min(limit ?? 100, 500);
    let cursor = ctx.db.query("mailJobs");
    if (status) {
      cursor = cursor.filter((f) => f.eq(f.field("status"), status));
    }
    const jobs = await cursor.order("desc").take(take);

    // Join: load each job's dispute case + owner email.
    const enriched = await Promise.all(
      jobs.map(async (job) => {
        const disputeCase = await ctx.db.get(job.disputeCaseId);
        const owner = disputeCase ? await ctx.db.get(disputeCase.userId) : null;
        return {
          ...job,
          disputeCase: disputeCase
            ? {
                _id: disputeCase._id,
                letterType: disputeCase.letterType,
                userId: disputeCase.userId,
                userEmail: owner?.email ?? "",
              }
            : null,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Admin: full mail-job detail bundle for `/admin/mail-jobs/[jobId]`.
 * Returns the job, its dispute case, owner email, tradeline (if any), and
 * the most recent 200 events.
 */
export const getForAdmin = query({
  args: { mailJobId: v.id("mailJobs") },
  handler: async (ctx, { mailJobId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);

    const job = await ctx.db.get(mailJobId);
    if (!job) return null;

    const disputeCase = await ctx.db.get(job.disputeCaseId);
    const owner = disputeCase ? await ctx.db.get(disputeCase.userId) : null;
    const tradeline =
      disputeCase && disputeCase.tradelineId
        ? await ctx.db.get(disputeCase.tradelineId)
        : null;

    const events = await ctx.db
      .query("mailJobEvents")
      .withIndex("by_job", (q) => q.eq("mailJobId", mailJobId))
      .order("desc")
      .take(200);

    return {
      job,
      disputeCase: disputeCase
        ? {
            _id: disputeCase._id,
            letterType: disputeCase.letterType,
            userId: disputeCase.userId,
            status: disputeCase.status,
          }
        : null,
      owner: owner
        ? { _id: owner._id, email: owner.email }
        : null,
      tradeline: tradeline
        ? {
            _id: tradeline._id,
            creditorName: tradeline.creditorName,
            bureau: tradeline.bureau,
          }
        : null,
      events,
    };
  },
});

// --- User-facing query -----------------------------------------------------

/**
 * User: detail bundle for the dashboard mail-job tracker.
 * Verifies the requesting user owns the underlying dispute case.
 */
export const getForCurrentUser = query({
  args: { mailJobId: v.id("mailJobs") },
  handler: async (ctx, { mailJobId }) => {
    const user = await requireUser(ctx);

    const job = await ctx.db.get(mailJobId);
    if (!job) return null;

    const disputeCase = await ctx.db.get(job.disputeCaseId);
    if (!disputeCase || disputeCase.userId !== user._id) {
      throw new Error("FORBIDDEN");
    }

    const events = await ctx.db
      .query("mailJobEvents")
      .withIndex("by_job", (q) => q.eq("mailJobId", mailJobId))
      .order("desc")
      .take(50);

    return {
      job,
      disputeCase: {
        _id: disputeCase._id,
        letterType: disputeCase.letterType,
        userId: disputeCase.userId,
      },
      events,
    };
  },
});

// --- Helpers used by the Next.js dispatcher -------------------------------
//
// The dispatcher runs in a number of contexts (admin retry server action,
// payment-completion webhook background job, etc.) that don't always carry a
// Clerk identity. Rather than requiring a token, these helpers are gated by
// `INTERNAL_SERVICE_SECRET` (a server-only env var that's never exposed to
// the browser). The Next.js routes/jobs in this scope read that secret from
// `process.env` and forward it.

function assertInternalSecret(secret: string) {
  const expected = process.env.INTERNAL_SERVICE_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Bundle of data the `dispatchLetter` job needs to assemble a LetterStream
 * submission. Replaces the old Prisma `findUniqueOrThrow` with `include`.
 */
export const getDispatchBundle = query({
  args: {
    secret: v.string(),
    disputeCaseId: v.id("disputeCases"),
  },
  handler: async (ctx, { secret, disputeCaseId }) => {
    assertInternalSecret(secret);

    const disputeCase = await ctx.db.get(disputeCaseId);
    if (!disputeCase) return null;

    const owner = await ctx.db.get(disputeCase.userId);
    const profile = owner
      ? await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", owner._id))
          .unique()
      : null;
    const tradeline =
      disputeCase.tradelineId != null
        ? await ctx.db.get(disputeCase.tradelineId)
        : null;

    return { disputeCase, owner, profile, tradeline };
  },
});

// --- Mutations: insert/update used by the dispatcher ----------------------

/**
 * Create the QUEUED mail job row (called by `dispatchLetter` before it
 * actually contacts LetterStream so we have an audit anchor).
 */
export const createQueued = mutation({
  args: {
    secret: v.string(),
    disputeCaseId: v.id("disputeCases"),
    mode: v.string(),
    certified: v.boolean(),
    err: v.boolean(),
    attempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const now = Date.now();
    return await ctx.db.insert("mailJobs", {
      disputeCaseId: args.disputeCaseId,
      provider: "LETTERSTREAM",
      mode: args.mode,
      certified: args.certified,
      err: args.err,
      status: "QUEUED",
      attempts: args.attempts ?? 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Patch a mail job row after we've heard back from LetterStream.
 */
export const patchAfterSubmit = mutation({
  args: {
    secret: v.string(),
    mailJobId: v.id("mailJobs"),
    status: mailJobStatusValidator,
    providerJobId: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    rawResponseJson: v.optional(v.any()),
    lastError: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.providerJobId !== undefined) patch.providerJobId = args.providerJobId;
    if (args.submittedAt !== undefined) patch.submittedAt = args.submittedAt;
    if (args.rawResponseJson !== undefined) patch.rawResponseJson = args.rawResponseJson;
    if (args.lastError !== undefined) {
      patch.lastError = args.lastError === null ? undefined : args.lastError;
    }
    await ctx.db.patch(args.mailJobId, patch);
  },
});

/**
 * Append an event row to a mail job's audit history.
 */
export const appendEvent = mutation({
  args: {
    secret: v.string(),
    mailJobId: v.id("mailJobs"),
    kind: v.string(),
    rawStatus: v.optional(v.string()),
    mappedStatus: v.optional(mailJobStatusValidator),
    message: v.optional(v.union(v.string(), v.null())),
    payloadJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    await ctx.db.insert("mailJobEvents", {
      mailJobId: args.mailJobId,
      kind: args.kind,
      rawStatus: args.rawStatus,
      mappedStatus: args.mappedStatus,
      message:
        args.message === null || args.message === undefined ? undefined : args.message,
      payloadJson: args.payloadJson,
      occurredAt: Date.now(),
    });
  },
});

/**
 * Patch a dispute case status (called by the dispatcher when a packet has
 * actually been mailed).
 */
export const patchDisputeStatus = mutation({
  args: {
    secret: v.string(),
    disputeCaseId: v.id("disputeCases"),
    status: disputeStatusValidator,
    mailedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const patch: Record<string, unknown> = { status: args.status };
    if (args.mailedAt !== undefined) patch.mailedAt = args.mailedAt;
    if (args.deliveredAt !== undefined) patch.deliveredAt = args.deliveredAt;
    await ctx.db.patch(args.disputeCaseId, patch);
  },
});

/**
 * Insert an audit log row from server-side jobs (e.g. dispatcher).
 */
export const writeAuditLog = mutation({
  args: {
    secret: v.string(),
    actorUserId: v.optional(v.id("users")),
    targetUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadataJson: v.any(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    await ctx.db.insert("auditLogs", {
      actorUserId: args.actorUserId,
      targetUserId: args.targetUserId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadataJson: args.metadataJson ?? {},
      createdAt: Date.now(),
    });
  },
});

// --- Admin retry mutation --------------------------------------------------

/**
 * Admin: prepare a FAILED job for retry. Records a RETRY event + audit log,
 * increments attempts, flips status back to QUEUED, and clears lastError.
 *
 * The actual re-dispatch (which contacts LetterStream) runs in the Next.js
 * route handler that calls this mutation, so we don't make outbound HTTP
 * from inside Convex.
 */
export const prepareRetry = mutation({
  args: { mailJobId: v.id("mailJobs") },
  handler: async (ctx, { mailJobId }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);

    const job = await ctx.db.get(mailJobId);
    if (!job) throw new Error("NOT_FOUND");
    if (job.status !== "FAILED") {
      throw new Error(
        `Mail job ${mailJobId} is in status ${job.status}. Only FAILED jobs can be retried.`,
      );
    }
    const disputeCase = await ctx.db.get(job.disputeCaseId);

    await ctx.db.insert("mailJobEvents", {
      mailJobId: job._id,
      kind: "RETRY",
      rawStatus: "manual_retry",
      message: `Manual retry initiated by admin ${actor._id}`,
      occurredAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: disputeCase?.userId,
      action: "MAIL_JOB_RETRY",
      entityType: "mailJobs",
      entityId: job._id,
      metadataJson: {
        previousAttempts: job.attempts,
        lastError: job.lastError ?? null,
      },
      createdAt: Date.now(),
    });

    await ctx.db.patch(job._id, {
      status: "QUEUED",
      attempts: job.attempts + 1,
      lastError: undefined,
      updatedAt: Date.now(),
    });

    return { disputeCaseId: job.disputeCaseId };
  },
});

// --- Webhook mutation (secret-gated) --------------------------------------

const ackOk = { ok: true };

/**
 * Public mutation called by the LetterStream webhook handler. Authenticated
 * not by Clerk but by an explicit shared secret the Next.js route forwards
 * from `LETTERSTREAM_WEBHOOK_SECRET`.
 *
 * Idempotency: the caller looks up the mail job by `providerJobId`; if no
 * row matches we still write an audit log entry but skip the state mutation.
 */
export const recordEventFromWebhook = mutation({
  args: {
    secret: v.string(),
    providerJobId: v.string(),
    rawStatus: v.optional(v.string()),
    mappedStatus: v.optional(mailJobStatusValidator),
    eventKind: v.string(),
    trackingCode: v.optional(v.string()),
    signatureRef: v.optional(v.string()),
    signedAt: v.optional(v.number()),
    payloadJson: v.optional(v.any()),
    apiVersion: v.optional(v.string()),
    timestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = Date.now();
    const job = await ctx.db
      .query("mailJobs")
      .withIndex("by_provider_job", (q) => q.eq("providerJobId", args.providerJobId))
      .first();

    if (!job) {
      await ctx.db.insert("auditLogs", {
        action: "LETTERSTREAM_EVENT_UNMATCHED",
        entityType: "mailJobs",
        entityId: args.providerJobId,
        metadataJson: {
          payload: args.payloadJson ?? null,
          apiVersion: args.apiVersion ?? null,
          timestamp: args.timestamp ?? null,
        },
        createdAt: now,
      });
      return { matched: false };
    }

    // Append-only event row.
    await ctx.db.insert("mailJobEvents", {
      mailJobId: job._id,
      kind: args.eventKind,
      rawStatus: args.rawStatus,
      mappedStatus: args.mappedStatus,
      payloadJson: args.payloadJson,
      occurredAt: now,
    });

    if (args.mappedStatus) {
      const patch: Record<string, unknown> = {
        status: args.mappedStatus,
        rawResponseJson: args.payloadJson,
        updatedAt: now,
      };
      if (args.trackingCode && !job.trackingCode) patch.trackingCode = args.trackingCode;
      if (args.mappedStatus === "MAILED" && !job.mailedAt) patch.mailedAt = now;
      if (args.mappedStatus === "DELIVERED" && !job.deliveredAt) patch.deliveredAt = now;
      if (args.signatureRef && !job.signatureRef) {
        patch.signatureRef = args.signatureRef;
        patch.signedAt = args.signedAt ?? now;
      }

      await ctx.db.patch(job._id, patch);

      if (args.mappedStatus === "DELIVERED") {
        const disputeCase = await ctx.db.get(job.disputeCaseId);
        if (disputeCase) {
          await ctx.db.patch(disputeCase._id, {
            status: "DELIVERED",
            deliveredAt: now,
          });
        }
      }
    }

    await ctx.db.insert("auditLogs", {
      action: "LETTERSTREAM_EVENT",
      entityType: "mailJobs",
      entityId: job._id,
      metadataJson: {
        rawStatus: args.rawStatus ?? null,
        mapped: args.mappedStatus ?? null,
        trackingCode: args.trackingCode ?? null,
        apiVersion: args.apiVersion ?? null,
        timestamp: args.timestamp ?? null,
      },
      createdAt: now,
    });

    return { matched: true, mailJobId: job._id, ...ackOk };
  },
});

/**
 * Public mutation for recording the "bad key" audit event when a webhook
 * arrives with an invalid LetterStream callback key. The Next.js route
 * still ACKs 200 to avoid retry storms; this just gives us a trace.
 */
export const recordBadCallbackKey = mutation({
  args: {
    secret: v.string(),
    apiVersion: v.optional(v.string()),
    timestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    await ctx.db.insert("auditLogs", {
      action: "LETTERSTREAM_CALLBACK_BAD_KEY",
      entityType: "mailJobs",
      entityId: "unknown",
      metadataJson: {
        apiVersion: args.apiVersion ?? null,
        timestamp: args.timestamp ?? null,
      },
      createdAt: Date.now(),
    });
  },
});

// --- Cron mutation: follow-up timer ---------------------------------------

/**
 * Daily sweep: any DELIVERED or RESPONSE_RECEIVED dispute whose
 * `responseDueAt` has elapsed gets flipped to ESCALATION_READY. An audit
 * row is written for every transition. Secret-gated; the Next.js cron
 * route extracts it from `CRON_SECRET` and forwards.
 */
export const scanForFollowUps = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const expected = process.env.CRON_SECRET;
    if (expected && expected !== secret) {
      throw new Error("FORBIDDEN");
    }

    const now = Date.now();
    // No dedicated index for status × responseDueAt — small enough table to
    // scan, then filter in memory. Fan-out is bounded by # of cases in
    // DELIVERED/RESPONSE_RECEIVED states.
    const all = await ctx.db.query("disputeCases").collect();
    const overdue: Doc<"disputeCases">[] = all.filter(
      (dc) =>
        (dc.status === "DELIVERED" || dc.status === "RESPONSE_RECEIVED") &&
        typeof dc.responseDueAt === "number" &&
        dc.responseDueAt < now,
    );

    let transitioned = 0;
    for (const dc of overdue) {
      await ctx.db.patch(dc._id, { status: "ESCALATION_READY" });
      await ctx.db.insert("auditLogs", {
        targetUserId: dc.userId,
        action: "AUTO_FOLLOW_UP_ELAPSED",
        entityType: "disputeCases",
        entityId: dc._id,
        metadataJson: {
          previousStatus: dc.status,
          responseDueAt: dc.responseDueAt ?? null,
          elapsedHours: dc.responseDueAt
            ? Math.round((now - dc.responseDueAt) / 3_600_000)
            : null,
        },
        createdAt: now,
      });
      transitioned += 1;
    }

    return {
      ok: true,
      scanned: overdue.length,
      transitioned,
      atMs: now,
    };
  },
});

// Re-export id types for callers.
export type MailJobId = Id<"mailJobs">;
export type MailJobEventId = Id<"mailJobEvents">;
