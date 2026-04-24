// Lead capture (PUBLIC, no auth).
//
// Marketing pages POST to /api/leads which forwards into this mutation.
// We rate-limit at the route, not here.

import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const create = mutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.string(),
    topic: v.optional(v.string()),
    referralCode: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("leads", {
      email: args.email,
      fullName: args.fullName,
      phone: args.phone,
      source: args.source,
      topic: args.topic,
      referralCode: args.referralCode,
      utmSource: args.utmSource,
      utmMedium: args.utmMedium,
      utmCampaign: args.utmCampaign,
      ipHash: args.ipHash,
      userAgent: args.userAgent,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorUserId: undefined,
      targetUserId: undefined,
      action: "LEAD_CAPTURED",
      entityType: "Lead",
      entityId: id as unknown as string,
      metadataJson: {
        source: args.source,
        topic: args.topic ?? null,
        referralCode: args.referralCode ?? null,
      },
      createdAt: now,
    });

    // If the lead arrived with a referral code, increment that referral.
    if (args.referralCode) {
      const ref = await ctx.db
        .query("referrals")
        .withIndex("by_code", (q) => q.eq("code", args.referralCode!))
        .unique();
      if (ref) {
        await ctx.db.patch(ref._id, { signups: ref.signups + 1 });
      }
    }

    return id;
  },
});
