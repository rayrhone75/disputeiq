// UserProfile (encrypted PII).
//
// The Next.js layer encrypts SSN/DOB/address/phone with AES-256-GCM via
// `lib/encryption.ts` before calling these mutations. Convex never sees
// the plaintext.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    fullName: v.string(),
    encryptedDob: v.string(),
    encryptedSsnLast4: v.string(),
    encryptedAddress1: v.string(),
    encryptedCity: v.string(),
    encryptedState: v.string(),
    encryptedZip: v.string(),
    encryptedPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName,
        encryptedDob: args.encryptedDob,
        encryptedSsnLast4: args.encryptedSsnLast4,
        encryptedAddress1: args.encryptedAddress1,
        encryptedCity: args.encryptedCity,
        encryptedState: args.encryptedState,
        encryptedZip: args.encryptedZip,
        encryptedPhone: args.encryptedPhone,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: user._id,
        targetUserId: user._id,
        action: "PROFILE_UPDATED",
        entityType: "UserProfile",
        entityId: existing._id as unknown as string,
        metadataJson: {},
        createdAt: now,
      });
      return { updated: true };
    }
    const id = await ctx.db.insert("userProfiles", {
      userId: user._id,
      fullName: args.fullName,
      encryptedDob: args.encryptedDob,
      encryptedSsnLast4: args.encryptedSsnLast4,
      encryptedAddress1: args.encryptedAddress1,
      encryptedCity: args.encryptedCity,
      encryptedState: args.encryptedState,
      encryptedZip: args.encryptedZip,
      encryptedPhone: args.encryptedPhone,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "PROFILE_CREATED",
      entityType: "UserProfile",
      entityId: id as unknown as string,
      metadataJson: {},
      createdAt: now,
    });
    return { created: true };
  },
});
