// Convex functions for the `platformSettings` key/value table.
//
// `valueJson` is opaque (`v.any()`); callers do their own typing. Keys are
// dot-namespaced (e.g. `idiq.affiliateUrl`) so we can prefix-search them.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers";

export const listByPrefix = query({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    // platformSettings keys are unique and dot-prefixed. Without an index
    // suited to prefix scans, fall back to a full collect — the table is
    // tiny and read-heavy.
    const all = await ctx.db.query("platformSettings").collect();
    return all.filter((row) => row.key.startsWith(prefix));
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
  },
});

export const upsert = mutation({
  args: { key: v.string(), valueJson: v.any() },
  handler: async (ctx, { key, valueJson }) => {
    const me = await requireRole(ctx, ["OWNER", "ADMIN"]);
    const existing = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        valueJson,
        updatedBy: me._id,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("platformSettings", {
      key,
      valueJson,
      updatedBy: me._id,
      updatedAt: now,
    });
  },
});
