// Convex functions for Credit Monitoring Connectors.
//
// Sessions track each credential-based auto-import attempt; the vault
// stores reusable provider logins (encrypted in the Node runtime BEFORE
// reaching here — these mutations accept ciphertext only). All writes are
// owner-scoped via requireUser; admin reads via requireRole.
//
// Gated by FEATURE_CREDIT_CONNECTORS at the API layer — these functions
// are inert until a connector route calls them.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";

const connectorStatus = v.union(
  v.literal("RUNNING"),
  v.literal("NEEDS_MFA"),
  v.literal("NEEDS_CAPTCHA"),
  v.literal("PREVIEW_READY"),
  v.literal("SAVED"),
  v.literal("FAILED"),
);

export const createSession = mutation({
  args: {
    provider: v.string(),
    rememberLogin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("creditConnectorSessions", {
      userId: me._id,
      provider: args.provider,
      status: "RUNNING",
      rememberLogin: args.rememberLogin,
      logJson: [],
      startedAt: now,
      updatedAt: now,
    });
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.id("creditConnectorSessions"),
    status: connectorStatus,
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    logJson: v.optional(v.array(v.any())),
    previewJson: v.optional(v.any()),
    encryptedDraft: v.optional(v.string()),
    draftBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("NOT_FOUND");
    if (session.userId !== me._id) throw new Error("FORBIDDEN");
    const now = Date.now();
    const terminal = args.status === "SAVED" || args.status === "FAILED";
    await ctx.db.patch(args.sessionId, {
      status: args.status,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      retryable: args.retryable,
      ...(args.logJson !== undefined ? { logJson: args.logJson } : {}),
      ...(args.previewJson !== undefined ? { previewJson: args.previewJson } : {}),
      ...(args.encryptedDraft !== undefined
        ? { encryptedDraft: args.encryptedDraft, draftBytes: args.draftBytes }
        : {}),
      updatedAt: now,
      ...(terminal ? { finishedAt: now } : {}),
    });
  },
});

export const finalizeSaved = mutation({
  args: {
    sessionId: v.id("creditConnectorSessions"),
    importId: v.id("creditReportImports"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("NOT_FOUND");
    if (session.userId !== me._id) throw new Error("FORBIDDEN");
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: "SAVED",
      importId: args.importId,
      // Drop the draft once it's been persisted as a real import.
      encryptedDraft: undefined,
      draftBytes: undefined,
      updatedAt: now,
      finishedAt: now,
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("creditConnectorSessions") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (session.userId !== me._id) throw new Error("FORBIDDEN");
    return session;
  },
});

export const listMySessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    return await ctx.db
      .query("creditConnectorSessions")
      .withIndex("by_user_started", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(limit);
  },
});

// ── Credential vault (remember-login) ───────────────────────────────
export const upsertVault = mutation({
  args: {
    provider: v.string(),
    encryptedCredentials: v.string(),
    usernameHint: v.optional(v.string()),
    ssnLast4Hint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("creditConnectorVault")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", me._id).eq("provider", args.provider),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedCredentials: args.encryptedCredentials,
        usernameHint: args.usernameHint,
        ssnLast4Hint: args.ssnLast4Hint,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("creditConnectorVault", {
      userId: me._id,
      provider: args.provider,
      encryptedCredentials: args.encryptedCredentials,
      usernameHint: args.usernameHint,
      ssnLast4Hint: args.ssnLast4Hint,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getVault = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    return await ctx.db
      .query("creditConnectorVault")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", me._id).eq("provider", args.provider),
      )
      .unique();
  },
});

export const deleteVault = mutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const existing = await ctx.db
      .query("creditConnectorVault")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", me._id).eq("provider", args.provider),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

// ── Admin diagnostics ───────────────────────────────────────────────
export const adminRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const recent = await ctx.db
      .query("creditConnectorSessions")
      .order("desc")
      .take(limit);
    // Aggregate outcome counts (never returns drafts / credentials).
    const counts: Record<string, number> = {};
    for (const s of recent) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return {
      counts,
      recent: recent.map((s) => ({
        _id: s._id,
        provider: s.provider,
        status: s.status,
        errorCode: s.errorCode ?? null,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt ?? null,
      })),
    };
  },
});
