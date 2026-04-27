// Payment intent + dispute checkout helpers.
//
// The Next.js layer creates the Stripe Checkout Session after this mutation
// returns the payment intent id. The Stripe webhook then patches the row to
// SUCCEEDED via `recordStripePayment`. Square equivalents remain below as
// legacy and are no longer hit by the live flow.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

const paymentStatus = v.union(
  v.literal("PENDING"),
  v.literal("SUCCEEDED"),
  v.literal("FAILED"),
  v.literal("REFUNDED"),
);

export const createForDispute = mutation({
  args: {
    disputeCaseId: v.id("disputeCases"),
    provider: v.string(),
    amountCents: v.number(),
    currency: v.optional(v.string()),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(args.disputeCaseId);
    if (!dc || dc.userId !== user._id) throw new Error("FORBIDDEN");

    const now = Date.now();
    const id = await ctx.db.insert("paymentIntents", {
      userId: user._id,
      disputeCaseId: args.disputeCaseId,
      provider: args.provider,
      amountCents: args.amountCents,
      currency: args.currency ?? "USD",
      status: "PENDING",
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "CHECKOUT_CREATED",
      entityType: "PaymentIntent",
      entityId: id as unknown as string,
      metadataJson: { amountCents: args.amountCents, provider: args.provider },
      createdAt: now,
    });
    return id;
  },
});

export const recordCheckoutConsent = mutation({
  args: {
    disputeCaseId: v.id("disputeCases"),
    paymentIntentId: v.id("paymentIntents"),
    termsVersion: v.string(),
    consents: v.any(),
    amountCents: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(args.disputeCaseId);
    if (!dc || dc.userId !== user._id) throw new Error("FORBIDDEN");
    const now = Date.now();
    await ctx.db.insert("consentReceipts", {
      userId: user._id,
      consentType: "DISPUTE_CHECKOUT",
      version: args.termsVersion,
      acceptedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "CHECKOUT_CONSENT_ACCEPTED",
      entityType: "DisputeCase",
      entityId: args.disputeCaseId as unknown as string,
      metadataJson: {
        termsVersion: args.termsVersion,
        consents: args.consents,
        packetDisputeCaseId: args.disputeCaseId,
        amountCents: args.amountCents,
        ip: args.ipAddress,
      },
      createdAt: now,
    });
    return { ok: true };
  },
});

// Stripe webhook hook for one-time payment events (packet charge).
export const recordStripePayment = mutation({
  args: {
    secret: v.string(),
    paymentIntentId: v.id("paymentIntents"),
    providerPaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!expected || args.secret !== expected) throw new Error("FORBIDDEN");
    const payment = await ctx.db.get(args.paymentIntentId);
    if (!payment) return { matched: false };
    if (
      payment.status === "SUCCEEDED" &&
      payment.providerPaymentId === args.providerPaymentId
    ) {
      return { matched: true, idempotent: true };
    }
    const now = Date.now();
    await ctx.db.patch(payment._id, {
      providerPaymentId: args.providerPaymentId,
      status: "SUCCEEDED",
      updatedAt: now,
    });
    if (payment.disputeCaseId) {
      const dc = await ctx.db.get(payment.disputeCaseId);
      if (dc) await ctx.db.patch(dc._id, { status: "PAID" });
    }
    await ctx.db.insert("auditLogs", {
      actorUserId: undefined,
      targetUserId: payment.userId,
      action: "PAYMENT_SUCCEEDED",
      entityType: "PaymentIntent",
      entityId: payment._id as unknown as string,
      metadataJson: { providerPaymentId: args.providerPaymentId, provider: "STRIPE" },
      createdAt: now,
    });
    return { matched: true, disputeCaseId: payment.disputeCaseId ?? null };
  },
});

// Square webhook hook for one-time payment events (packet charge). LEGACY.
export const recordSquarePayment = mutation({
  args: {
    secret: v.string(),
    paymentIntentId: v.id("paymentIntents"),
    providerPaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
    if (!expected || args.secret !== expected) throw new Error("FORBIDDEN");
    const payment = await ctx.db.get(args.paymentIntentId);
    if (!payment) return { matched: false };
    if (
      payment.status === "SUCCEEDED" &&
      payment.providerPaymentId === args.providerPaymentId
    ) {
      return { matched: true, idempotent: true };
    }
    const now = Date.now();
    await ctx.db.patch(payment._id, {
      providerPaymentId: args.providerPaymentId,
      status: "SUCCEEDED",
      updatedAt: now,
    });
    if (payment.disputeCaseId) {
      const dc = await ctx.db.get(payment.disputeCaseId);
      if (dc) await ctx.db.patch(dc._id, { status: "PAID" });
    }
    await ctx.db.insert("auditLogs", {
      actorUserId: undefined,
      targetUserId: payment.userId,
      action: "PAYMENT_SUCCEEDED",
      entityType: "PaymentIntent",
      entityId: payment._id as unknown as string,
      metadataJson: { providerPaymentId: args.providerPaymentId },
      createdAt: now,
    });
    return { matched: true, disputeCaseId: payment.disputeCaseId ?? null };
  },
});

// Look up a dispute case (for the dashboard checkout page).
export const disputeCaseForCheckout = query({
  args: { id: v.id("disputeCases") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(id);
    if (!dc || dc.userId !== user._id) return null;
    const tradeline = dc.tradelineId ? await ctx.db.get(dc.tradelineId) : null;
    return { case: dc, tradeline };
  },
});
