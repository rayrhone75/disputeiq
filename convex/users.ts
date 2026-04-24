// Convex functions for the `users` table.
//
// Clerk owns authentication; Convex mirrors each Clerk identity as a row so
// other tables can FK against it. Call `upsertFromClerk` after sign-in to
// materialize the row; read via `currentUser`.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
  },
});

export const upsertFromClerk = mutation({
  args: {
    email: v.string(),
    role: v.optional(
      v.union(
        v.literal("OWNER"),
        v.literal("ADMIN"),
        v.literal("SUPPORT"),
        v.literal("USER"),
      ),
    ),
  },
  handler: async (ctx, { email, role }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    const now = Date.now();
    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: now };
      if (existing.email !== email) patch.email = email;
      if (role && existing.role !== role) patch.role = role;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email,
      role: role ?? "USER",
      isGraceUser: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});
