// Admin-only customer actions used by the Customer 360 page.
//
// Every mutation here:
//   - Requires OWNER / ADMIN / SUPPORT role.
//   - Writes an audit-log row recording the actor, the target customer,
//     and the structured details of the action.
//
// Notes / follow-ups / VIP flag — the schema lives in convex/schema.ts.
// The Customer 360 client reads via /api/admin/customers/[id] which
// fetches `notesForCustomer` + `followUpsForCustomer` alongside the
// existing customerConsole result.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers";

const NOTE_CATEGORY = v.union(
  v.literal("general"),
  v.literal("billing"),
  v.literal("escalation"),
  v.literal("compliance"),
);

const FOLLOWUP_STATUS = v.union(
  v.literal("pending"),
  v.literal("done"),
  v.literal("dismissed"),
);

// ───────────────────────────────────────────────────────────────────────
// VIP
// ───────────────────────────────────────────────────────────────────────

export const setVip = mutation({
  args: {
    customerId: v.id("users"),
    vip: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch(args.customerId, {
      isVip: args.vip,
      vipMarkedAt: args.vip ? now : undefined,
      vipMarkedByUserId: args.vip ? actor._id : undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: args.vip ? "ADMIN_MARKED_VIP" : "ADMIN_UNMARKED_VIP",
      entityType: "User",
      entityId: args.customerId as unknown as string,
      metadataJson: { vip: args.vip },
      createdAt: now,
    });
    return { ok: true, vip: args.vip };
  },
});

// ───────────────────────────────────────────────────────────────────────
// Notes
// ───────────────────────────────────────────────────────────────────────

export const notesForCustomer = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const rows = await ctx.db
      .query("customerNotes")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .order("desc")
      .take(200);
    return rows;
  },
});

export const addNote = mutation({
  args: {
    customerId: v.id("users"),
    body: v.string(),
    category: NOTE_CATEGORY,
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const trimmed = args.body.trim();
    if (!trimmed) throw new Error("EMPTY_BODY");
    if (trimmed.length > 8000) throw new Error("BODY_TOO_LONG");
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    const id = await ctx.db.insert("customerNotes", {
      customerId: args.customerId,
      authorUserId: actor._id,
      authorEmail: actor.email,
      category: args.category,
      body: trimmed,
      pinned: args.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: "ADMIN_NOTE_CREATED",
      entityType: "CustomerNote",
      entityId: id as unknown as string,
      metadataJson: { category: args.category, pinned: args.pinned ?? false },
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const editNote = mutation({
  args: {
    noteId: v.id("customerNotes"),
    body: v.optional(v.string()),
    category: v.optional(NOTE_CATEGORY),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("NOTE_NOT_FOUND");
    // Authors can edit their own notes; OWNER/ADMIN can edit anyone's.
    if (
      note.authorUserId !== actor._id &&
      actor.role !== "OWNER" &&
      actor.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof args.body === "string") {
      const trimmed = args.body.trim();
      if (!trimmed) throw new Error("EMPTY_BODY");
      if (trimmed.length > 8000) throw new Error("BODY_TOO_LONG");
      patch.body = trimmed;
    }
    if (args.category) patch.category = args.category;
    if (typeof args.pinned === "boolean") patch.pinned = args.pinned;
    await ctx.db.patch(args.noteId, patch);
    await ctx.db.insert("auditLogs", {
      targetUserId: note.customerId,
      actorUserId: actor._id,
      action: "ADMIN_NOTE_UPDATED",
      entityType: "CustomerNote",
      entityId: args.noteId as unknown as string,
      metadataJson: {
        fields: Object.keys(patch).filter((k) => k !== "updatedAt"),
      },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("customerNotes") },
  handler: async (ctx, { noteId }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const note = await ctx.db.get(noteId);
    if (!note) throw new Error("NOTE_NOT_FOUND");
    if (
      note.authorUserId !== actor._id &&
      actor.role !== "OWNER" &&
      actor.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }
    await ctx.db.delete(noteId);
    await ctx.db.insert("auditLogs", {
      targetUserId: note.customerId,
      actorUserId: actor._id,
      action: "ADMIN_NOTE_DELETED",
      entityType: "CustomerNote",
      entityId: noteId as unknown as string,
      metadataJson: { category: note.category },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ───────────────────────────────────────────────────────────────────────
// Follow-ups
// ───────────────────────────────────────────────────────────────────────

export const followUpsForCustomer = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const rows = await ctx.db
      .query("customerFollowUps")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .order("asc")
      .take(50);
    return rows;
  },
});

export const addFollowUp = mutation({
  args: {
    customerId: v.id("users"),
    body: v.string(),
    dueAt: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const trimmed = args.body.trim();
    if (!trimmed) throw new Error("EMPTY_BODY");
    if (trimmed.length > 1000) throw new Error("BODY_TOO_LONG");
    if (!Number.isFinite(args.dueAt)) throw new Error("BAD_DUE_AT");
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const now = Date.now();
    const id = await ctx.db.insert("customerFollowUps", {
      customerId: args.customerId,
      createdByUserId: actor._id,
      body: trimmed,
      dueAt: args.dueAt,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: "ADMIN_FOLLOWUP_CREATED",
      entityType: "CustomerFollowUp",
      entityId: id as unknown as string,
      metadataJson: { dueAt: args.dueAt },
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const updateFollowUp = mutation({
  args: {
    followUpId: v.id("customerFollowUps"),
    status: FOLLOWUP_STATUS,
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const row = await ctx.db.get(args.followUpId);
    if (!row) throw new Error("FOLLOWUP_NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch(args.followUpId, {
      status: args.status,
      completedAt: args.status === "pending" ? undefined : now,
      completedByUserId: args.status === "pending" ? undefined : actor._id,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: row.customerId,
      actorUserId: actor._id,
      action: `ADMIN_FOLLOWUP_${args.status.toUpperCase()}`,
      entityType: "CustomerFollowUp",
      entityId: args.followUpId as unknown as string,
      metadataJson: { status: args.status },
      createdAt: now,
    });
    return { ok: true };
  },
});

// ───────────────────────────────────────────────────────────────────────
// Logging-only helpers — used by the API layer when an admin action
// happens partly outside Convex (e.g. Clerk magic-link generation).
// ───────────────────────────────────────────────────────────────────────

export const logAdminAction = mutation({
  args: {
    customerId: v.id("users"),
    action: v.string(),
    metadataJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: args.action,
      entityType: "User",
      entityId: args.customerId as unknown as string,
      metadataJson: args.metadataJson ?? {},
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
