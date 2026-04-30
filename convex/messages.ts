// Two-way messaging between customers and admins.
//
// Access model:
//   - A customer can read/write threads where thread.customerId === me.
//   - An admin (OWNER/ADMIN/SUPPORT) can read/write any thread.
//
// Unread state lives on the thread (one boolean per side); no per-message
// receipts. When a customer reads, we flip unreadForCustomer = false;
// when an admin reads, we flip unreadForAdmin = false.
//
// Every state-changing mutation writes an audit-log row so the timeline
// in Customer 360 picks the event up automatically.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUser } from "./helpers";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "SUPPORT"]);
const MAX_BODY = 8000;
const AUDIT_BODY_PREVIEW = 80;

type ActorContext = {
  user: Doc<"users">;
  isAdmin: boolean;
};

async function actor(ctx: QueryCtx | MutationCtx): Promise<ActorContext> {
  const user = await requireUser(ctx);
  return { user, isAdmin: ADMIN_ROLES.has(user.role) };
}

async function loadThreadOrThrow(
  ctx: QueryCtx | MutationCtx,
  threadId: Id<"messageThreads">,
): Promise<Doc<"messageThreads">> {
  const t = await ctx.db.get(threadId);
  if (!t) throw new Error("THREAD_NOT_FOUND");
  return t;
}

function assertCanAccess(t: Doc<"messageThreads">, a: ActorContext) {
  if (a.isAdmin) return;
  if (t.customerId !== a.user._id) throw new Error("FORBIDDEN");
}

function bodyPreview(body: string): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= AUDIT_BODY_PREVIEW) return t;
  return t.slice(0, AUDIT_BODY_PREVIEW - 1) + "…";
}

// ── Customer-facing queries ─────────────────────────────────────────────

export const listMyThreads = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db
      .query("messageThreads")
      .withIndex("by_customer", (q) => q.eq("customerId", me._id))
      .order("desc")
      .take(50);
    return rows;
  },
});

/**
 * Per-side unread counts.
 *   customer caller → returns # of unread threads on the customer side.
 *   admin caller → returns # of unread threads across all customers.
 */
export const myUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const a = await actor(ctx);
    if (a.isAdmin) {
      const rows = await ctx.db
        .query("messageThreads")
        .withIndex("by_admin_unread", (q) => q.eq("unreadForAdmin", true))
        .take(200);
      return rows.length;
    }
    const rows = await ctx.db
      .query("messageThreads")
      .withIndex("by_customer_unread", (q) =>
        q.eq("customerId", a.user._id).eq("unreadForCustomer", true),
      )
      .take(200);
    return rows.length;
  },
});

export const getThread = query({
  args: { threadId: v.id("messageThreads") },
  handler: async (ctx, { threadId }) => {
    const a = await actor(ctx);
    const t = await loadThreadOrThrow(ctx, threadId);
    assertCanAccess(t, a);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(500);
    return { thread: t, messages };
  },
});

// ── Admin-facing queries ────────────────────────────────────────────────

export const listThreadsForCustomer = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, { customerId }) => {
    const a = await actor(ctx);
    if (!a.isAdmin) throw new Error("FORBIDDEN");
    return await ctx.db
      .query("messageThreads")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .order("desc")
      .take(100);
  },
});

/**
 * Threads with admin-side unread, newest first. Hydrated with the
 * customer's email so the admin home can render a recognizable list.
 */
export const adminAttentionFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const a = await actor(ctx);
    if (!a.isAdmin) throw new Error("FORBIDDEN");
    const take = Math.min(Math.max(limit ?? 12, 1), 100);
    const rows = await ctx.db
      .query("messageThreads")
      .withIndex("by_admin_unread", (q) => q.eq("unreadForAdmin", true))
      .order("desc")
      .take(take);
    const hydrated = await Promise.all(
      rows.map(async (t) => {
        const customer = await ctx.db.get(t.customerId);
        return {
          thread: t,
          customer: customer
            ? { _id: customer._id, email: customer.email, isVip: !!customer.isVip }
            : null,
        };
      }),
    );
    return hydrated;
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const createThread = mutation({
  args: {
    customerId: v.optional(v.id("users")),
    subject: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const a = await actor(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("EMPTY_BODY");
    if (body.length > MAX_BODY) throw new Error("BODY_TOO_LONG");

    // Resolve customer:
    //   - admin must specify customerId.
    //   - customer is implicitly themselves.
    let customerId: Id<"users">;
    if (a.isAdmin) {
      if (!args.customerId) throw new Error("CUSTOMER_ID_REQUIRED");
      const customer = await ctx.db.get(args.customerId);
      if (!customer) throw new Error("USER_NOT_FOUND");
      customerId = args.customerId;
    } else {
      if (args.customerId && args.customerId !== a.user._id) {
        throw new Error("FORBIDDEN");
      }
      customerId = a.user._id;
    }

    const subject = (args.subject ?? "").trim().slice(0, 200) || undefined;
    const now = Date.now();
    const fromRole: "customer" | "admin" = a.isAdmin ? "admin" : "customer";

    const threadId = await ctx.db.insert("messageThreads", {
      customerId,
      subject,
      status: "open",
      lastMessageAt: now,
      lastMessageFrom: fromRole,
      unreadForCustomer: fromRole === "admin",
      unreadForAdmin: fromRole === "customer",
      lastAdminUserId: fromRole === "admin" ? a.user._id : undefined,
      createdByUserId: a.user._id,
      createdAt: now,
    });

    const messageId = await ctx.db.insert("messages", {
      threadId,
      customerId,
      fromUserId: a.user._id,
      fromRole,
      body,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      targetUserId: customerId,
      actorUserId: a.user._id,
      action: "MESSAGE_THREAD_CREATED",
      entityType: "MessageThread",
      entityId: threadId as unknown as string,
      metadataJson: {
        from: fromRole,
        bodyPreview: bodyPreview(body),
        bodyChars: body.length,
        subject: subject ?? null,
      },
      createdAt: now,
    });

    return { ok: true, threadId, messageId };
  },
});

export const sendMessage = mutation({
  args: {
    threadId: v.id("messageThreads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const a = await actor(ctx);
    const t = await loadThreadOrThrow(ctx, args.threadId);
    assertCanAccess(t, a);

    const body = args.body.trim();
    if (!body) throw new Error("EMPTY_BODY");
    if (body.length > MAX_BODY) throw new Error("BODY_TOO_LONG");

    const fromRole: "customer" | "admin" = a.isAdmin ? "admin" : "customer";
    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      customerId: t.customerId,
      fromUserId: a.user._id,
      fromRole,
      body,
      createdAt: now,
    });

    // Update thread with new last-activity + flip the OTHER side's unread.
    const patch: Partial<Doc<"messageThreads">> = {
      lastMessageAt: now,
      lastMessageFrom: fromRole,
      unreadForCustomer:
        fromRole === "admin" ? true : t.unreadForCustomer,
      unreadForAdmin:
        fromRole === "customer" ? true : t.unreadForAdmin,
      // Replying re-opens a resolved thread.
      status: t.status === "resolved" ? "open" : t.status,
    };
    if (fromRole === "admin") {
      patch.lastAdminUserId = a.user._id;
    }
    if (t.status === "resolved" && patch.status === "open") {
      patch.resolvedAt = undefined;
      patch.resolvedByUserId = undefined;
    }
    await ctx.db.patch(args.threadId, patch);

    await ctx.db.insert("auditLogs", {
      targetUserId: t.customerId,
      actorUserId: a.user._id,
      action: "MESSAGE_SENT",
      entityType: "MessageThread",
      entityId: args.threadId as unknown as string,
      metadataJson: {
        from: fromRole,
        bodyPreview: bodyPreview(body),
        bodyChars: body.length,
      },
      createdAt: now,
    });

    return { ok: true, messageId };
  },
});

export const markRead = mutation({
  args: { threadId: v.id("messageThreads") },
  handler: async (ctx, { threadId }) => {
    const a = await actor(ctx);
    const t = await loadThreadOrThrow(ctx, threadId);
    assertCanAccess(t, a);
    const patch: Partial<Doc<"messageThreads">> = {};
    if (a.isAdmin) {
      if (t.unreadForAdmin) patch.unreadForAdmin = false;
    } else {
      if (t.unreadForCustomer) patch.unreadForCustomer = false;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(threadId, patch);
    }
    return { ok: true };
  },
});

export const setResolved = mutation({
  args: {
    threadId: v.id("messageThreads"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const a = await actor(ctx);
    if (!a.isAdmin) throw new Error("FORBIDDEN");
    const t = await loadThreadOrThrow(ctx, args.threadId);
    const now = Date.now();
    await ctx.db.patch(args.threadId, {
      status: args.resolved ? "resolved" : "open",
      resolvedAt: args.resolved ? now : undefined,
      resolvedByUserId: args.resolved ? a.user._id : undefined,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: t.customerId,
      actorUserId: a.user._id,
      action: args.resolved
        ? "MESSAGE_THREAD_RESOLVED"
        : "MESSAGE_THREAD_REOPENED",
      entityType: "MessageThread",
      entityId: args.threadId as unknown as string,
      metadataJson: { resolved: args.resolved },
      createdAt: now,
    });
    return { ok: true };
  },
});

export const setEscalated = mutation({
  args: {
    threadId: v.id("messageThreads"),
    escalated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const a = await actor(ctx);
    if (!a.isAdmin) throw new Error("FORBIDDEN");
    const t = await loadThreadOrThrow(ctx, args.threadId);
    const now = Date.now();
    await ctx.db.patch(args.threadId, {
      escalated: args.escalated,
      escalatedAt: args.escalated ? now : undefined,
      escalatedByUserId: args.escalated ? a.user._id : undefined,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: t.customerId,
      actorUserId: a.user._id,
      action: args.escalated
        ? "MESSAGE_THREAD_ESCALATED"
        : "MESSAGE_THREAD_DEESCALATED",
      entityType: "MessageThread",
      entityId: args.threadId as unknown as string,
      metadataJson: { escalated: args.escalated },
      createdAt: now,
    });
    return { ok: true };
  },
});
