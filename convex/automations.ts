// Phase-4 Automation Engine — Convex layer.
//
// Three pieces:
//
//   1. listOpenEvents / listEvents — admin queries with optional
//      severity/status filters.
//   2. setEventStatus — admin marks an event as reviewed or resolved.
//   3. runRuleSweep — walks all users, applies the pure rules from
//      `lib/admin/automation-rules.ts`, upserts events idempotently.
//
// Idempotency model:
//   - For every (customerId, ruleKey) pair, at most ONE event in any
//     non-archived state can exist for an active firing.
//   - When a rule fires and an open event exists → bump `lastSeenAt`.
//   - When a rule fires and no open event exists (but a resolved one
//     does) → insert a new event (the rule re-fired after recovery).
//   - When a rule does NOT fire and an open event exists → auto-resolve
//     it with `resolvedReason: "auto"`.
//   - `first_deletion` is fire-once: we set `firstDeletionAlreadyFired`
//     based on whether ANY event of that key (any status) exists.
//
// Pure rules live in `lib/admin/automation-rules.ts`. We import the
// Convex compatibility layer below — Convex's bundler can ingest TS
// from `lib/` directly.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRole } from "./helpers";
import {
  runAutomationRules,
  type AutomationFiring,
  type AutomationInput,
} from "../lib/admin/automation-rules";

const ADMIN_ROLES = ["OWNER", "ADMIN", "SUPPORT"] as const;

// ── Queries ─────────────────────────────────────────────────────────────

export const listEvents = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("reviewed"),
        v.literal("resolved"),
      ),
    ),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warn"), v.literal("alert")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ADMIN_ROLES as unknown as Doc<"users">["role"][]);
    const take = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const status = args.status ?? "open";
    let rows;
    if (args.severity) {
      rows = await ctx.db
        .query("automationEvents")
        .withIndex("by_status_severity", (q) =>
          q.eq("status", status).eq("severity", args.severity!),
        )
        .order("desc")
        .take(take);
    } else {
      rows = await ctx.db
        .query("automationEvents")
        .withIndex("by_status_created", (q) => q.eq("status", status))
        .order("desc")
        .take(take);
    }
    // Hydrate with customer email so the admin feed shows recognizable rows.
    return await Promise.all(
      rows.map(async (r) => {
        const customer = await ctx.db.get(r.customerId);
        return {
          ...r,
          customer: customer
            ? {
                _id: customer._id,
                email: customer.email,
                isVip: !!customer.isVip,
                archivedAt: customer.archivedAt ?? null,
              }
            : null,
        };
      }),
    );
  },
});

export const eventCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ADMIN_ROLES as unknown as Doc<"users">["role"][]);
    const open = await ctx.db
      .query("automationEvents")
      .withIndex("by_status_created", (q) => q.eq("status", "open"))
      .collect();
    let alerts = 0;
    let warns = 0;
    let infos = 0;
    for (const e of open) {
      if (e.severity === "alert") alerts++;
      else if (e.severity === "warn") warns++;
      else infos++;
    }
    return {
      open: open.length,
      alert: alerts,
      warn: warns,
      info: infos,
    };
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const setEventStatus = mutation({
  args: {
    eventId: v.id("automationEvents"),
    status: v.union(v.literal("reviewed"), v.literal("resolved"), v.literal("open")),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(
      ctx,
      ADMIN_ROLES as unknown as Doc<"users">["role"][],
    );
    const ev = await ctx.db.get(args.eventId);
    if (!ev) throw new Error("EVENT_NOT_FOUND");
    const now = Date.now();
    const patch: Partial<Doc<"automationEvents">> = { status: args.status };
    if (args.status === "reviewed") {
      patch.reviewedAt = now;
      patch.reviewedByUserId = actor._id;
    }
    if (args.status === "resolved") {
      patch.resolvedAt = now;
      patch.resolvedByUserId = actor._id;
      patch.resolvedReason = "manual";
    }
    if (args.status === "open") {
      patch.reviewedAt = undefined;
      patch.reviewedByUserId = undefined;
      patch.resolvedAt = undefined;
      patch.resolvedByUserId = undefined;
      patch.resolvedReason = undefined;
    }
    await ctx.db.patch(args.eventId, patch);
    await ctx.db.insert("auditLogs", {
      targetUserId: ev.customerId,
      actorUserId: actor._id,
      action: `AUTOMATION_EVENT_${args.status.toUpperCase()}`,
      entityType: "AutomationEvent",
      entityId: args.eventId as unknown as string,
      metadataJson: { ruleKey: ev.ruleKey, severity: ev.severity },
      createdAt: now,
    });
    return { ok: true };
  },
});

/**
 * Idempotent sweep. Walks all users, runs rules, upserts events.
 * Returns counters so the UI can confirm what fired.
 */
export const runRuleSweep = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireRole(
      ctx,
      ADMIN_ROLES as unknown as Doc<"users">["role"][],
    );
    const now = Date.now();
    const dryRun = !!args.dryRun;
    const cutoffActivityMs = now - 100 * 24 * 60 * 60 * 1000; // safety cutoff

    const users = await ctx.db.query("users").collect();
    let opened = 0;
    let bumped = 0;
    let autoResolved = 0;

    for (const u of users) {
      // Build the input snapshot for this user.
      const [
        subscription,
        latestImport,
        allImports,
        disputes,
        followUps,
        priorEvents,
        recentLogs,
      ] = await Promise.all([
        ctx.db
          .query("userSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .unique(),
        ctx.db
          .query("creditReportImports")
          .withIndex("by_user_status", (q) => q.eq("userId", u._id))
          .order("desc")
          .first(),
        ctx.db
          .query("creditReportImports")
          .withIndex("by_user_status", (q) => q.eq("userId", u._id))
          .collect(),
        ctx.db
          .query("disputeCases")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect(),
        ctx.db
          .query("customerFollowUps")
          .withIndex("by_customer_status", (q) =>
            q.eq("customerId", u._id).eq("status", "pending"),
          )
          .collect(),
        ctx.db
          .query("automationEvents")
          .withIndex("by_customer_rule", (q) => q.eq("customerId", u._id))
          .collect(),
        ctx.db
          .query("auditLogs")
          .withIndex("by_target", (q) => q.eq("targetUserId", u._id))
          .order("desc")
          .first(),
      ]);

      const deletions = disputes.filter((d) => d.status === "CLOSED").length;
      const firstDeletionAlreadyFired = priorEvents.some(
        (e) => e.ruleKey === "first_deletion",
      );
      const lastActivityAt =
        recentLogs && recentLogs.createdAt > cutoffActivityMs
          ? recentLogs.createdAt
          : null;

      const input: AutomationInput = {
        user: {
          _id: u._id as unknown as string,
          createdAt: u.createdAt,
          isVip: !!u.isVip,
          archivedAt: u.archivedAt ?? null,
        },
        hasActiveSubscription:
          !!subscription && subscription.status === "active",
        subscriptionStatus: subscription?.status ?? null,
        importsCount: allImports.length,
        latestImportStatus: latestImport?.status ?? null,
        latestImportNormalizedAt: latestImport?.normalizedAt ?? null,
        disputesStarted: disputes.length,
        deletionsCount: deletions,
        pendingFollowUpsCount: followUps.length,
        lastActivityAt,
        firstDeletionAlreadyFired,
        nowMs: now,
      };

      const firings = runAutomationRules(input);
      const firingByKey = new Map<string, AutomationFiring>(
        firings.map((f) => [f.ruleKey, f]),
      );

      // ── Upsert firings.
      for (const f of firings) {
        const existing = priorEvents.find(
          (e) => e.ruleKey === f.ruleKey && e.status === "open",
        );
        if (existing) {
          if (!dryRun) {
            await ctx.db.patch(existing._id, {
              lastSeenAt: now,
              severity: f.severity,
              label: f.label,
              payloadJson: f.payload ?? existing.payloadJson,
            });
          }
          bumped++;
        } else {
          // No open event. For first_deletion, also skip if ANY prior
          // event exists (fire-once); the rule already gates on this
          // via firstDeletionAlreadyFired, so we wouldn't be here, but
          // belt-and-suspenders.
          if (
            f.ruleKey === "first_deletion" &&
            priorEvents.some((e) => e.ruleKey === "first_deletion")
          ) {
            continue;
          }
          if (!dryRun) {
            const id = await ctx.db.insert("automationEvents", {
              customerId: u._id,
              ruleKey: f.ruleKey,
              severity: f.severity,
              status: "open",
              label: f.label,
              payloadJson: f.payload ?? undefined,
              firstFiredAt: now,
              lastSeenAt: now,
              createdAt: now,
            });
            await ctx.db.insert("auditLogs", {
              targetUserId: u._id,
              actorUserId: actor._id,
              action: "AUTOMATION_EVENT_CREATED",
              entityType: "AutomationEvent",
              entityId: id as unknown as string,
              metadataJson: {
                ruleKey: f.ruleKey,
                severity: f.severity,
                payload: f.payload ?? null,
              },
              createdAt: now,
            });
          }
          opened++;
        }
      }

      // ── Auto-resolve open events whose rules no longer fire.
      const stillOpen = priorEvents.filter((e) => e.status === "open");
      for (const e of stillOpen) {
        if (firingByKey.has(e.ruleKey)) continue; // still firing — handled above
        if (!dryRun) {
          await ctx.db.patch(e._id, {
            status: "resolved",
            resolvedAt: now,
            resolvedByUserId: undefined,
            resolvedReason: "auto",
          });
          await ctx.db.insert("auditLogs", {
            targetUserId: u._id,
            actorUserId: actor._id,
            action: "AUTOMATION_EVENT_AUTO_RESOLVED",
            entityType: "AutomationEvent",
            entityId: e._id as unknown as string,
            metadataJson: { ruleKey: e.ruleKey },
            createdAt: now,
          });
        }
        autoResolved++;
      }
    }

    return {
      ok: true,
      dryRun,
      opened,
      bumped,
      autoResolved,
      sweptUsers: users.length,
      ranAt: now,
    };
  },
});
