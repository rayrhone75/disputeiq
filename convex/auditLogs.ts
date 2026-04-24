// Convex audit log helpers.
//
// All mutations that touch user-affecting state should also write an
// auditLogs row. This module exposes a `write` mutation for routes that
// don't have a more specific Convex mutation, plus query helpers used by
// the admin views.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";
import type { Id } from "./_generated/dataModel";

/**
 * Append-only audit log writer.
 *
 * The caller must be authenticated. The actor is always set to the calling
 * user's Convex id; the `targetUserId` is optional and may differ (e.g.
 * for admin operations).
 */
export const write = mutation({
  args: {
    targetUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadataJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    const id = await ctx.db.insert("auditLogs", {
      targetUserId: args.targetUserId,
      actorUserId: actor._id,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadataJson: args.metadataJson ?? {},
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Append a row without an actor (e.g. lead capture, public webhook).
 * Authentication is not required, but a shared secret guards the call.
 */
export const writeSystem = mutation({
  args: {
    secret: v.string(),
    targetUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadataJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
    if (!expected || args.secret !== expected) throw new Error("FORBIDDEN");
    return await ctx.db.insert("auditLogs", {
      targetUserId: args.targetUserId,
      actorUserId: undefined,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadataJson: args.metadataJson ?? {},
      createdAt: Date.now(),
    });
  },
});

/**
 * Most recent audit-log entries (admin command-center widget).
 */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const take = Math.min(Math.max(limit ?? 50, 1), 500);
    return await ctx.db.query("auditLogs").order("desc").take(take);
  },
});

/**
 * Audit-log entries that touch a given user (target OR actor). Used by the
 * support customer console.
 */
export const forUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const take = Math.min(Math.max(limit ?? 30, 1), 500);
    const [asTarget, asActor] = await Promise.all([
      ctx.db
        .query("auditLogs")
        .withIndex("by_target", (q) => q.eq("targetUserId", userId))
        .order("desc")
        .take(take),
      ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorUserId", userId))
        .order("desc")
        .take(take),
    ]);
    const merged = [...asTarget, ...asActor]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        (row, idx, arr) => arr.findIndex((r) => r._id === row._id) === idx,
      )
      .slice(0, take);

    // Hydrate actor email so the timeline can render "actor.email · time".
    const actorIds = Array.from(
      new Set(merged.map((r) => r.actorUserId).filter(Boolean)),
    ) as Id<"users">[];
    const actors = await Promise.all(actorIds.map((id) => ctx.db.get(id)));
    const actorMap = new Map<string, string>();
    for (const a of actors) {
      if (a) actorMap.set(a._id as unknown as string, a.email);
    }
    return merged.map((row) => ({
      ...row,
      actorEmail: row.actorUserId
        ? actorMap.get(row.actorUserId as unknown as string) ?? null
        : null,
    }));
  },
});
