// Convex functions for the `extensionPairings` table.
//
// Every long-lived extension-token issued by DisputeIQ has exactly one row
// here. The raw token never leaves the user's chrome.storage; this table
// stores only its SHA-256 hash plus operational metadata (last use, last
// error, revoked state). Service-secret-gated mutations write here from
// the Next.js extension API routes; a single Clerk-auth query lets the
// dashboard list a user's paired extensions.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUserOrNull, requireUser } from "./helpers";
import type { Id } from "./_generated/dataModel";

function assertInternalSecret(secret: string) {
  const expected = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!expected || secret !== expected) {
    throw new Error("FORBIDDEN_SERVICE_SECRET");
  }
}

// ── Customer-facing query ─────────────────────────────────────────────

/**
 * List the calling user's extension pairings (active + revoked). Used
 * by the dashboard ExtensionPairingCard to show a paired-extensions
 * roster with revoke buttons.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    // Use the non-throwing variant so first-time users (Clerk identity
    // exists but no Convex users row yet) get an empty list instead of
    // a "USER_NOT_MIRRORED" exception. The exception form was bubbling
    // through fetchQuery as a generic "Server Error" and turning the
    // dashboard's connector card into a red banner for every new
    // account on first visit.
    const user = await currentUserOrNull(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("extensionPairings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b.pairedAt - a.pairedAt);
    // Strip tokenHash — never expose to the client.
    return rows.map((r) => ({
      _id: r._id,
      extensionVersion: r.extensionVersion ?? null,
      userAgent: r.userAgent ?? null,
      pairedAt: r.pairedAt,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt ?? null,
      lastImportAt: r.lastImportAt ?? null,
      lastErrorAt: r.lastErrorAt ?? null,
      lastError: r.lastError ?? null,
      revoked: r.revoked,
      revokedAt: r.revokedAt ?? null,
    }));
  },
});

/**
 * Customer-initiated revoke. The extension's token immediately stops
 * working at the API gate (lookup by tokenHash returns revoked=true).
 */
export const revokeMine = mutation({
  args: { id: v.id("extensionPairings") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("NOT_FOUND");
    if (row.userId !== user._id) throw new Error("FORBIDDEN");
    if (row.revoked) return { ok: true, alreadyRevoked: true };
    const now = Date.now();
    await ctx.db.patch(id, {
      revoked: true,
      revokedAt: now,
      revokedReason: "user_revoked",
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "EXTENSION_REVOKED",
      entityType: "ExtensionPairing",
      entityId: id as unknown as string,
      metadataJson: { reason: "user_revoked" },
      createdAt: now,
    });
    return { ok: true };
  },
});

// ── Service-secret mutations (called from /api/extension/* routes) ───

export const createPairing = mutation({
  args: {
    secret: v.string(),
    userId: v.id("users"),
    tokenHash: v.string(),
    pairJti: v.optional(v.string()),
    extensionVersion: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const now = Date.now();
    const id = await ctx.db.insert("extensionPairings", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      pairJti: args.pairJti,
      extensionVersion: args.extensionVersion,
      userAgent: args.userAgent?.slice(0, 500),
      pairedAt: now,
      expiresAt: args.expiresAt,
      revoked: false,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: args.userId,
      targetUserId: args.userId,
      action: "EXTENSION_PAIRED",
      entityType: "ExtensionPairing",
      entityId: id as unknown as string,
      metadataJson: {
        extensionVersion: args.extensionVersion ?? null,
        expiresAt: args.expiresAt,
      },
      createdAt: now,
    });
    return id;
  },
});

/**
 * Look up a pairing by tokenHash. Returns the row if active and not
 * revoked, otherwise null. Service-secret-gated so the API routes can
 * authenticate extension imports without holding a Clerk session.
 */
export const lookupActiveByTokenHash = query({
  args: { secret: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const row = await ctx.db
      .query("extensionPairings")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!row) return null;
    if (row.revoked) return null;
    if (Date.now() > row.expiresAt) return null;
    return row;
  },
});

export const recordUsage = mutation({
  args: {
    secret: v.string(),
    pairingId: v.id("extensionPairings"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const row = await ctx.db.get(args.pairingId);
    if (!row) return { ok: false };
    await ctx.db.patch(args.pairingId, { lastUsedAt: Date.now() });
    return { ok: true };
  },
});

export const recordImport = mutation({
  args: {
    secret: v.string(),
    pairingId: v.id("extensionPairings"),
    importId: v.id("creditReportImports"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const row = await ctx.db.get(args.pairingId);
    if (!row) return { ok: false };
    const now = Date.now();
    await ctx.db.patch(args.pairingId, {
      lastImportAt: now,
      lastImportId: args.importId,
      lastUsedAt: now,
      lastError: undefined,
      lastErrorAt: undefined,
    });
    return { ok: true };
  },
});

export const recordFailure = mutation({
  args: {
    secret: v.string(),
    pairingId: v.id("extensionPairings"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const row = await ctx.db.get(args.pairingId);
    if (!row) return { ok: false };
    const now = Date.now();
    await ctx.db.patch(args.pairingId, {
      lastError: args.error.slice(0, 500),
      lastErrorAt: now,
      lastUsedAt: now,
    });
    return { ok: true };
  },
});

/**
 * Service-side revoke — used if we detect token abuse (rate limit) or
 * during admin actions. Customer revoke goes through revokeMine.
 */
export const revokeAsService = mutation({
  args: {
    secret: v.string(),
    pairingId: v.id("extensionPairings"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const row = await ctx.db.get(args.pairingId);
    if (!row || row.revoked) return { ok: true };
    const now = Date.now();
    await ctx.db.patch(args.pairingId, {
      revoked: true,
      revokedAt: now,
      revokedReason: args.reason.slice(0, 200),
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: undefined,
      targetUserId: row.userId,
      action: "EXTENSION_REVOKED",
      entityType: "ExtensionPairing",
      entityId: args.pairingId as unknown as string,
      metadataJson: { reason: args.reason },
      createdAt: now,
    });
    return { ok: true };
  },
});

/**
 * Resolve a pairing's user — used by the import endpoint after a
 * successful token verify so the import pipeline can run as that user.
 */
export const userIdForPairing = query({
  args: { secret: v.string(), pairingId: v.id("extensionPairings") },
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    assertInternalSecret(args.secret);
    const row = await ctx.db.get(args.pairingId);
    if (!row) return null;
    if (row.revoked) return null;
    return row.userId;
  },
});
