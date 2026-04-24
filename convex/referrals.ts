// Referral codes — get-or-create per user, plus the public click counter.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

export const getOrCreateForUser = mutation({
  args: { code: v.optional(v.string()) },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .first();
    if (existing) return existing;
    if (!code) throw new Error("CODE_REQUIRED");
    const now = Date.now();
    const id = await ctx.db.insert("referrals", {
      code,
      ownerUserId: user._id,
      clicks: 0,
      signups: 0,
      conversions: 0,
      rewardCents: 0,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("referrals")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .first();
  },
});

// PUBLIC click tracker — referral landing route hits this without auth.
export const recordClick = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const ref = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!ref) return { matched: false };
    await ctx.db.patch(ref._id, { clicks: ref.clicks + 1 });
    return { matched: true };
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
  },
});
