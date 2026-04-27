// Subscription / plan management.
//
// `userSubscriptions` mirrors a Stripe recurring subscription. The Next.js
// layer talks to Stripe (Checkout + Customer Portal); webhook events flow
// into `recordStripeEvent` which keeps Convex billing state in sync.
// Square mutations (`recordSquareEvent`) remain in this file as legacy
// — gated off in the routes layer but kept here so any in-flight Square
// events still validate.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";
import type { Doc, Id } from "./_generated/dataModel";

// ─── Read ──────────────────────────────────────────────────────────────────

export const getForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

/**
 * Packet usage for the calling user's current billing cycle.
 * Used by the dashboard packet meter + checkout pricing.
 */
export const usageForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const sub = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!sub || sub.status !== "active") {
      return {
        plan: null,
        included: 0,
        used: 0,
        remaining: 0,
        cycleStart: null,
        cycleEnd: null,
        overagePriceCents: 1995,
      };
    }
    const cases = await ctx.db
      .query("disputeCases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const counted = cases.filter(
      (c) =>
        ["PAID", "MAILED", "DELIVERED", "RESPONSE_RECEIVED", "CLOSED"].includes(
          c.status,
        ) &&
        c.mailedAt != null &&
        c.mailedAt >= sub.cycleStart,
    );
    const used = counted.length;
    const remaining = Math.max(0, sub.includedPackets - used);
    return {
      plan: sub.planCode,
      included: sub.includedPackets,
      used,
      remaining,
      cycleStart: sub.cycleStart,
      cycleEnd: sub.cycleEnd,
      overagePriceCents: sub.overagePacketPriceCents,
    };
  },
});

// ─── Mutations (customer-driven) ───────────────────────────────────────────

export const upsertForUser = mutation({
  args: {
    planCode: v.string(),
    status: v.string(),
    cycleStart: v.number(),
    cycleEnd: v.number(),
    includedPackets: v.number(),
    overagePacketPriceCents: v.number(),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    squareSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        planCode: args.planCode,
        status: args.status,
        cycleStart: args.cycleStart,
        cycleEnd: args.cycleEnd,
        includedPackets: args.includedPackets,
        overagePacketPriceCents: args.overagePacketPriceCents,
        stripeSubscriptionId:
          args.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId ?? existing.stripeCustomerId,
        squareSubscriptionId:
          args.squareSubscriptionId ?? existing.squareSubscriptionId,
        updatedAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: user._id,
        targetUserId: user._id,
        action: "SUBSCRIPTION_CREATED",
        entityType: "UserSubscription",
        entityId: existing._id as unknown as string,
        metadataJson: {
          planCode: args.planCode,
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripeCustomerId: args.stripeCustomerId,
        },
        createdAt: now,
      });
      return existing._id;
    }
    const id = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      planCode: args.planCode,
      status: args.status,
      cycleStart: args.cycleStart,
      cycleEnd: args.cycleEnd,
      includedPackets: args.includedPackets,
      overagePacketPriceCents: args.overagePacketPriceCents,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      squareSubscriptionId: args.squareSubscriptionId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "SUBSCRIPTION_CREATED",
      entityType: "UserSubscription",
      entityId: id as unknown as string,
      metadataJson: {
        planCode: args.planCode,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
      },
      createdAt: now,
    });
    return id;
  },
});

export const cancelForUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const sub = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!sub) throw new Error("NO_SUBSCRIPTION");
    const now = Date.now();
    await ctx.db.patch(sub._id, { status: "canceled", updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "SUBSCRIPTION_CANCELED",
      entityType: "UserSubscription",
      entityId: sub._id as unknown as string,
      metadataJson: { planCode: sub.planCode },
      createdAt: now,
    });
    return {
      ok: true,
      stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
      stripeCustomerId: sub.stripeCustomerId ?? null,
      squareSubscriptionId: sub.squareSubscriptionId ?? null,
    };
  },
});

// ─── Stripe webhook (system-secret guarded) ────────────────────────────────

const STRIPE_KIND = v.union(
  v.literal("subscription_event"),
  v.literal("invoice_payment_succeeded"),
  v.literal("invoice_payment_failed"),
  v.literal("checkout_completed"),
);

export const recordStripeEvent = mutation({
  args: {
    secret: v.string(),
    kind: STRIPE_KIND,
    eventType: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeStatus: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()), // unix seconds (Stripe convention)
    currentPeriodEnd: v.optional(v.number()),
    planCode: v.optional(v.string()),
    includedPackets: v.optional(v.number()),
    overagePacketPriceCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!expected || args.secret !== expected) throw new Error("FORBIDDEN");

    let sub: Doc<"userSubscriptions"> | null = null;
    if (args.stripeSubscriptionId) {
      sub =
        (await ctx.db
          .query("userSubscriptions")
          .withIndex("by_stripe_subscription", (q) =>
            q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
          )
          .unique()) ?? null;
    }
    if (!sub && args.stripeCustomerId) {
      sub =
        (await ctx.db
          .query("userSubscriptions")
          .withIndex("by_stripe_customer", (q) =>
            q.eq("stripeCustomerId", args.stripeCustomerId),
          )
          .unique()) ?? null;
    }
    if (!sub) return { matched: false };

    const now = Date.now();

    if (args.kind === "subscription_event" || args.kind === "checkout_completed") {
      const mappedStatus = mapStripeStatus(args.stripeStatus ?? "");
      const cycleStart = args.currentPeriodStart
        ? args.currentPeriodStart * 1000
        : sub.cycleStart;
      const cycleEnd = args.currentPeriodEnd
        ? args.currentPeriodEnd * 1000
        : sub.cycleEnd;
      await ctx.db.patch(sub._id, {
        status: mappedStatus,
        stripeSubscriptionId:
          args.stripeSubscriptionId ?? sub.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId ?? sub.stripeCustomerId,
        planCode: args.planCode ?? sub.planCode,
        includedPackets: args.includedPackets ?? sub.includedPackets,
        overagePacketPriceCents:
          args.overagePacketPriceCents ?? sub.overagePacketPriceCents,
        cycleStart,
        cycleEnd,
        updatedAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: `SUBSCRIPTION_${args.eventType.toUpperCase().replace(/[.\s]/g, "_")}`,
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: {
          stripeStatus: args.stripeStatus,
          mappedStatus,
          stripeSubscriptionId: args.stripeSubscriptionId,
          stripeCustomerId: args.stripeCustomerId,
        },
        createdAt: now,
      });
    } else if (args.kind === "invoice_payment_failed") {
      await ctx.db.patch(sub._id, { status: "past_due", updatedAt: now });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_PAYMENT_FAILED",
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: { stripeCustomerId: args.stripeCustomerId },
        createdAt: now,
      });
    } else if (args.kind === "invoice_payment_succeeded") {
      const cycleStart = args.currentPeriodStart
        ? args.currentPeriodStart * 1000
        : now;
      const cycleEnd = args.currentPeriodEnd
        ? args.currentPeriodEnd * 1000
        : now + 30 * 86400000;
      await ctx.db.patch(sub._id, {
        status: "active",
        cycleStart,
        cycleEnd,
        includedPackets: args.includedPackets ?? sub.includedPackets,
        updatedAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_RENEWED",
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: { stripeCustomerId: args.stripeCustomerId },
        createdAt: now,
      });
    }

    return { matched: true };
  },
});

function mapStripeStatus(s: string): string {
  // Stripe subscription.status values:
  // active | past_due | unpaid | canceled | incomplete | incomplete_expired |
  // trialing | paused
  switch ((s ?? "").toLowerCase()) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "incomplete":
      return "pending";
    default:
      return "active";
  }
}

// ─── Square webhook (system-secret guarded) ─ LEGACY ──────────────────────

const KIND = v.union(
  v.literal("subscription_event"),
  v.literal("invoice_payment_failed"),
  v.literal("invoice_payment_made"),
);

export const recordSquareEvent = mutation({
  args: {
    secret: v.string(),
    kind: KIND,
    eventType: v.string(),
    squareSubscriptionId: v.optional(v.string()),
    squareCustomerId: v.optional(v.string()),
    squareStatus: v.optional(v.string()),
    chargedThroughDate: v.optional(v.string()),
    includedPacketsHint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
    if (!expected || args.secret !== expected) throw new Error("FORBIDDEN");

    let sub: Doc<"userSubscriptions"> | null = null;
    if (args.squareSubscriptionId) {
      const all = await ctx.db.query("userSubscriptions").collect();
      sub =
        all.find((s) => s.squareSubscriptionId === args.squareSubscriptionId) ??
        null;
    }
    if (!sub && args.squareCustomerId) {
      // Find by audit log SUBSCRIPTION_CREATED metadata
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) => q.eq("entityType", "UserSubscription"))
        .collect();
      const match = logs.find((l) => {
        const meta = l.metadataJson as Record<string, unknown> | undefined;
        return (
          l.action === "SUBSCRIPTION_CREATED" &&
          meta?.squareCustomerId === args.squareCustomerId
        );
      });
      if (match?.targetUserId) {
        sub =
          (await ctx.db
            .query("userSubscriptions")
            .withIndex("by_user", (q) => q.eq("userId", match.targetUserId!))
            .unique()) ?? null;
      }
    }
    if (!sub) return { matched: false };

    const now = Date.now();

    if (args.kind === "subscription_event") {
      const mappedStatus = mapSquareStatus(args.squareStatus ?? "");
      await ctx.db.patch(sub._id, {
        status: mappedStatus,
        squareSubscriptionId:
          args.squareSubscriptionId ?? sub.squareSubscriptionId,
        cycleEnd: args.chargedThroughDate
          ? new Date(args.chargedThroughDate).getTime()
          : sub.cycleEnd,
        updatedAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: `SUBSCRIPTION_${args.eventType.toUpperCase().replace(".", "_")}`,
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: {
          squareStatus: args.squareStatus,
          mappedStatus,
          squareSubId: args.squareSubscriptionId,
          chargedThrough: args.chargedThroughDate,
        },
        createdAt: now,
      });
    } else if (args.kind === "invoice_payment_failed") {
      await ctx.db.patch(sub._id, { status: "past_due", updatedAt: now });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_PAYMENT_FAILED",
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: { squareCustomerId: args.squareCustomerId },
        createdAt: now,
      });
    } else if (args.kind === "invoice_payment_made") {
      const cycleStart = now;
      const cycleEnd = now + 30 * 86400000;
      await ctx.db.patch(sub._id, {
        status: "active",
        cycleStart,
        cycleEnd,
        includedPackets: args.includedPacketsHint ?? sub.includedPackets,
        updatedAt: now,
      });
      await ctx.db.insert("auditLogs", {
        actorUserId: undefined,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_RENEWED",
        entityType: "UserSubscription",
        entityId: sub._id as unknown as string,
        metadataJson: { squareCustomerId: args.squareCustomerId },
        createdAt: now,
      });
    }

    return { matched: true };
  },
});

function mapSquareStatus(s: string): string {
  switch ((s ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "CANCELED":
      return "canceled";
    case "DELINQUENT":
      return "past_due";
    case "PAUSED":
      return "past_due";
    case "PENDING":
      return "pending";
    default:
      return "active";
  }
}
