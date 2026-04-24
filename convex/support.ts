// Support workspace — internal-only customer notes + a fast lookup query
// used by the support search UI.
//
// All functions require OWNER, ADMIN, or SUPPORT role.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers";
import type { Doc, Id } from "./_generated/dataModel";

const categoryValidator = v.union(
  v.literal("general"),
  v.literal("billing"),
  v.literal("report"),
  v.literal("escalation"),
);

// ─── Notes ─────────────────────────────────────────────────────────────────

export const listNotes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const rows = await ctx.db
      .query("supportNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Pinned first, then most recent.
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    const authorIds = Array.from(
      new Set(rows.map((r) => r.authorUserId).filter(Boolean)),
    ) as Id<"users">[];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map<string, string>();
    for (const a of authors) {
      if (a) authorMap.set(a._id as unknown as string, a.email);
    }

    return rows.map((n) => ({
      ...n,
      author: n.authorUserId
        ? { email: authorMap.get(n.authorUserId as unknown as string) ?? "" }
        : null,
    }));
  },
});

export const createNote = mutation({
  args: {
    userId: v.id("users"),
    body: v.string(),
    category: v.optional(categoryValidator),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("USER_NOT_FOUND");

    const now = Date.now();
    const id = await ctx.db.insert("supportNotes", {
      userId: args.userId,
      authorUserId: actor._id,
      body: args.body,
      category: args.category ?? "general",
      pinned: !!args.pinned,
      isInternal: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: args.userId,
      action: "SUPPORT_NOTE_CREATED",
      entityType: "SupportNote",
      entityId: id as unknown as string,
      metadataJson: {
        category: args.category ?? "general",
        pinned: !!args.pinned,
        length: args.body.length,
      },
      createdAt: now,
    });

    const note = await ctx.db.get(id);
    return {
      ...note!,
      author: { email: actor.email },
    };
  },
});

export const deleteNote = mutation({
  args: { id: v.id("supportNotes") },
  handler: async (ctx, { id }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("NOT_FOUND");
    await ctx.db.delete(id);
    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: existing.userId,
      action: "SUPPORT_NOTE_DELETED",
      entityType: "SupportNote",
      entityId: id as unknown as string,
      metadataJson: { category: existing.category },
      createdAt: Date.now(),
    });
    return { deleted: true };
  },
});

// ─── Search ────────────────────────────────────────────────────────────────

export const searchUsers = query({
  args: {
    q: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { q, includeArchived, limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const query = (q ?? "").trim().toLowerCase();

    // Convex doesn't have substring indexes — pull the most-recent N users
    // and filter in-memory. For a support tool this is more than enough.
    const all = await ctx.db.query("users").order("desc").take(500);

    let filtered: Doc<"users">[] = all;
    if (!includeArchived) filtered = filtered.filter((u) => !u.archivedAt);

    if (query) {
      filtered = filtered.filter((u) => {
        if (u.email.toLowerCase().includes(query)) return true;
        if ((u._id as unknown as string) === query) return true;
        return false;
      });

      // Also try matching by import id (last 8 chars) — pull imports if no
      // user matches and the query looks like an id fragment.
      if (filtered.length === 0 && query.length >= 6) {
        const imports = await ctx.db.query("creditReportImports").take(500);
        const importMatch = imports.find((i) =>
          (i._id as unknown as string).includes(query),
        );
        if (importMatch) {
          const owner = await ctx.db.get(importMatch.userId);
          if (owner) filtered = [owner];
        }
      }
    }

    filtered = filtered.slice(0, take);

    // Hydrate counts.
    const result = await Promise.all(
      filtered.map(async (u) => {
        const [creditImports, disputes, supportNotes] = await Promise.all([
          ctx.db
            .query("creditReportImports")
            .withIndex("by_user_status", (q) => q.eq("userId", u._id))
            .collect(),
          ctx.db
            .query("disputeCases")
            .withIndex("by_user", (q) => q.eq("userId", u._id))
            .collect(),
          ctx.db
            .query("supportNotes")
            .withIndex("by_user", (q) => q.eq("userId", u._id))
            .collect(),
        ]);
        return {
          ...u,
          _count: {
            creditImports: creditImports.length,
            disputes: disputes.length,
            supportNotes: supportNotes.length,
          },
        };
      }),
    );
    return result;
  },
});
