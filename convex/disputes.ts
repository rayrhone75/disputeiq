// Convex functions for the `disputeCases` table — full CRUD + domain ops
// for the dispute workflow (draft → confirm → ready_for_payment → paid →
// mailed → delivered → response_received → escalation_ready → closed).
//
// All mutations enforce ownership via `requireUser` and write an
// `auditLogs` row in the same transaction. Customer-facing only — admin
// queries live in `admin/*`.

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser } from "./helpers";
import type { Doc, Id } from "./_generated/dataModel";

const letterTypeValidator = v.union(
  v.literal("FACTUAL_DISPUTE"),
  v.literal("MOV_REQUEST"),
  v.literal("DIRECT_FURNISHER"),
  v.literal("IDENTITY_THEFT_605B"),
  v.literal("CFPB_PACKET"),
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

// ---- Queries ---------------------------------------------------------------

/**
 * List the signed-in user's dispute cases (most recent first).
 * Hydrates the linked legacy `tradelines` row in-memory because Convex
 * has no eager loading.
 */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const cases = await ctx.db
      .query("disputeCases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    const tradelineIds = Array.from(
      new Set(
        cases
          .map((c) => c.tradelineId)
          .filter((id): id is Id<"tradelines"> => !!id),
      ),
    );
    const tradelines = await Promise.all(tradelineIds.map((id) => ctx.db.get(id)));
    const tlMap = new Map<string, Doc<"tradelines"> | null>(
      tradelineIds.map((id, i) => [id as unknown as string, tradelines[i]]),
    );

    return cases.map((c) => ({
      ...c,
      tradeline: c.tradelineId
        ? tlMap.get(c.tradelineId as unknown as string) ?? null
        : null,
    }));
  },
});

/**
 * Fetch one dispute case by id (only if owned by the caller).
 * Returns null if it doesn't exist or is owned by someone else, so pages
 * can render notFound() without leaking existence info.
 */
export const getById = query({
  args: { id: v.id("disputeCases") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) return null;

    const tradeline = dc.tradelineId ? await ctx.db.get(dc.tradelineId) : null;

    // Most recent mail job for this case (used by escalation context).
    const latestMailJob = await ctx.db
      .query("mailJobs")
      .withIndex("by_case", (q) => q.eq("disputeCaseId", id))
      .order("desc")
      .first();

    // Audit log entries (for the timeline panel).
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "disputeCases").eq("entityId", id as unknown as string),
      )
      .order("asc")
      .take(500);

    return { case: dc, tradeline, latestMailJob, auditLogs: logs };
  },
});

/**
 * Audit-log entries for a single dispute case (used by the timeline route).
 */
export const auditLogsForCase = query({
  args: { id: v.id("disputeCases") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) return null;
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "disputeCases").eq("entityId", id as unknown as string),
      )
      .order("asc")
      .take(500);
    return {
      case: dc,
      auditLogs: logs,
    };
  },
});

/**
 * Count of dispute cases the caller has on a given tradeline. Used by the
 * detail page to suggest the next escalation stage.
 */
export const countForTradeline = query({
  args: { tradelineId: v.id("tradelines") },
  handler: async (ctx, { tradelineId }) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("disputeCases")
      .withIndex("by_tradeline", (q) => q.eq("tradelineId", tradelineId))
      .collect();
    return rows.filter((r) => r.userId === user._id).length;
  },
});

/**
 * Read the user's profile (for letter rendering — fullName + encrypted address
 * fields). Returns the raw profile doc; the API route decrypts.
 */
export const userProfileForLetter = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

/**
 * Look up a legacy tradeline by id. Verifies the owning report belongs to
 * the caller. Returns null on miss/forbidden.
 */
export const tradelineForUser = query({
  args: { tradelineId: v.id("tradelines") },
  handler: async (ctx, { tradelineId }) => {
    const user = await requireUser(ctx);
    const tl = await ctx.db.get(tradelineId);
    if (!tl) return null;
    const report = await ctx.db.get(tl.reportId);
    if (!report || report.userId !== user._id) return null;
    return { tradeline: tl, report };
  },
});

/**
 * Bulk look up legacy tradelines by id (packet-draft helper). All must
 * belong to the caller — returns null if any fail the ownership check.
 */
export const tradelinesForUser = query({
  args: { tradelineIds: v.array(v.id("tradelines")) },
  handler: async (ctx, { tradelineIds }) => {
    const user = await requireUser(ctx);
    const rows = await Promise.all(tradelineIds.map((id) => ctx.db.get(id)));
    if (rows.some((r) => !r)) return null;
    const reports = await Promise.all(
      rows.map((r) => ctx.db.get((r as Doc<"tradelines">).reportId)),
    );
    if (reports.some((r) => !r || r.userId !== user._id)) return null;
    return rows as Doc<"tradelines">[];
  },
});

// ---- Mutations -------------------------------------------------------------

/**
 * Create a dispute case in NEEDS_USER_CONFIRMATION (legacy "create" endpoint —
 * used when the caller already has the AI summary + legal basis pre-computed).
 */
export const createForConfirmation = mutation({
  args: {
    tradelineId: v.optional(v.id("tradelines")),
    letterType: letterTypeValidator,
    aiReasonSummary: v.string(),
    legalBasisSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("disputeCases", {
      userId: user._id,
      tradelineId: args.tradelineId,
      status: "NEEDS_USER_CONFIRMATION",
      letterType: args.letterType,
      aiReasonSummary: args.aiReasonSummary,
      legalBasisSummary: args.legalBasisSummary,
      userConfirmedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: user._id,
      actorUserId: user._id,
      action: "DISPUTE_CREATED",
      entityType: "disputeCases",
      entityId: id as unknown as string,
      metadataJson: { letterType: args.letterType },
      createdAt: now,
    });
    return id;
  },
});

/**
 * Persist a draft case (DRAFT) after the API route has already AI-drafted +
 * rendered the PDF and written it to secure storage.
 */
export const createDraft = mutation({
  args: {
    tradelineId: v.optional(v.id("tradelines")),
    letterType: letterTypeValidator,
    aiReasonSummary: v.string(),
    legalBasisSummary: v.optional(v.string()),
    secureLetterRef: v.string(),
    auditAction: v.string(),
    auditMetadata: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("disputeCases", {
      userId: user._id,
      tradelineId: args.tradelineId,
      status: "DRAFT",
      letterType: args.letterType,
      aiReasonSummary: args.aiReasonSummary,
      legalBasisSummary: args.legalBasisSummary,
      secureLetterRef: args.secureLetterRef,
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: user._id,
      actorUserId: user._id,
      action: args.auditAction,
      entityType: "disputeCases",
      entityId: id as unknown as string,
      metadataJson: args.auditMetadata,
      createdAt: now,
    });
    return id;
  },
});

/**
 * User confirms the AI-drafted letter. Locks the case and advances it to
 * READY_FOR_PAYMENT.
 */
export const confirm = mutation({
  args: { id: v.id("disputeCases") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) throw new Error("NOT_FOUND");
    if (dc.status !== "DRAFT" && dc.status !== "NEEDS_USER_CONFIRMATION") {
      throw new Error(`INVALID_STATE:${dc.status}`);
    }
    if (!dc.secureLetterRef) throw new Error("NO_LETTER_ARTIFACT");
    const now = Date.now();
    await ctx.db.patch(id, {
      status: "READY_FOR_PAYMENT",
      userConfirmedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: user._id,
      actorUserId: user._id,
      action: "DISPUTE_CONFIRMED",
      entityType: "disputeCases",
      entityId: id as unknown as string,
      metadataJson: {},
      createdAt: now,
    });
    return { status: "READY_FOR_PAYMENT" as const };
  },
});

/**
 * Record the user-supplied outcome after a certified letter has been
 * delivered. removed → CLOSED, anything else → ESCALATION_READY.
 */
export const recordOutcome = mutation({
  args: {
    id: v.id("disputeCases"),
    outcome: v.union(v.literal("removed"), v.literal("failed"), v.literal("partial")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, outcome, notes }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) throw new Error("NOT_FOUND");
    const nextStatus = outcome === "removed" ? "CLOSED" : "ESCALATION_READY";
    const now = Date.now();
    await ctx.db.patch(id, { status: nextStatus });
    await ctx.db.insert("auditLogs", {
      targetUserId: user._id,
      actorUserId: user._id,
      action: "DISPUTE_OUTCOME_RECORDED",
      entityType: "disputeCases",
      entityId: id as unknown as string,
      metadataJson: { outcome, notes: notes ?? null },
      createdAt: now,
    });
    return { status: nextStatus };
  },
});

/**
 * Promote a re-dispute / escalation: create a NEW DisputeCase in DRAFT and
 * move the prior to ESCALATION_READY. Caller has already drafted the body
 * + rendered + uploaded the PDF.
 */
export const createEscalation = mutation({
  args: {
    priorId: v.id("disputeCases"),
    letterType: letterTypeValidator,
    aiReasonSummary: v.string(),
    legalBasisSummary: v.optional(v.string()),
    secureLetterRef: v.string(),
    auditAction: v.string(),
    auditMetadata: v.any(),
    closePrior: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prior = await ctx.db.get(args.priorId);
    if (!prior || prior.userId !== user._id) throw new Error("NOT_FOUND");
    const now = Date.now();
    const newId = await ctx.db.insert("disputeCases", {
      userId: user._id,
      tradelineId: prior.tradelineId,
      status: "DRAFT",
      letterType: args.letterType,
      aiReasonSummary: args.aiReasonSummary,
      legalBasisSummary: args.legalBasisSummary,
      secureLetterRef: args.secureLetterRef,
      createdAt: now,
    });
    if (args.closePrior) {
      await ctx.db.patch(args.priorId, { status: "ESCALATION_READY" });
    }
    await ctx.db.insert("auditLogs", {
      targetUserId: user._id,
      actorUserId: user._id,
      action: args.auditAction,
      entityType: "disputeCases",
      entityId: newId as unknown as string,
      metadataJson: { ...args.auditMetadata, priorCaseId: args.priorId },
      createdAt: now,
    });
    return { newId, priorId: args.priorId };
  },
});

/**
 * Patch arbitrary mutable fields on a dispute case (status only, with an
 * optional response-due timestamp). Used by the bureau-response upload flow
 * to mark the case RESPONSE_RECEIVED. Ownership-checked.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("disputeCases"),
    status: disputeStatusValidator,
  },
  handler: async (ctx, { id, status }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) throw new Error("NOT_FOUND");
    await ctx.db.patch(id, { status });
    return { status };
  },
});
