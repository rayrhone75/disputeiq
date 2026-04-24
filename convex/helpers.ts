// Shared helpers for Convex queries + mutations.
//
// All domain modules (creditImports.ts, disputes.ts, etc.) use these to
// authenticate + look up the current user's Convex row. Keeps auth logic
// in one place so role checks are consistent.

import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Require a signed-in Clerk identity. Returns the subject id (Clerk user id).
 * Throws if no Clerk token is present.
 */
export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  return identity;
}

/**
 * Require a signed-in user whose Convex `users` row exists.
 * Returns the full Convex user document. Throws if unauthenticated or if the
 * user hasn't been upserted yet (caller should run `users.upsertFromClerk`
 * after sign-in).
 */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  if (!user) throw new Error("USER_NOT_MIRRORED");
  return user;
}

/**
 * Require a user whose role is in the allowed list.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowed: Array<Doc<"users">["role"]>,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!allowed.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

/**
 * Return user doc or null — does not throw. For queries where unauthenticated
 * callers should get an empty result instead of an error.
 */
export async function currentUserOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
}

export type UserId = Id<"users">;
