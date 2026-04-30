// App-layer billing overrides.
//
// Stripe remains the source of truth for actual charges. These
// mutations only touch DisputeIQ's own user row to flag a customer as
// comped / discounted / on a custom rate. The customer-facing UI reads
// these flags to suppress upgrade prompts; the admin Customer 360
// renders an "Override" badge.
//
// All write paths require OWNER or ADMIN role. SUPPORT is read-only on
// billing — they can SEE the state via the existing customerConsole
// query, but cannot mutate it.
//
// Every change writes an audit row capturing: previous override (if
// any), new override, value, reason, and the admin who made the change.

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./helpers";
import type { Doc } from "./_generated/dataModel";

const OVERRIDE_TYPE = v.union(
  v.literal("free"),
  v.literal("discounted"),
  v.literal("custom"),
);

function snapshotOverride(u: Doc<"users">) {
  return {
    type: u.billingOverride ?? null,
    value: u.billingOverrideValue ?? null,
    reason: u.billingOverrideReason ?? null,
    byUserId: u.billingOverrideByUserId ?? null,
    at: u.billingOverrideAt ?? null,
    expiresAt: u.billingOverrideExpiresAt ?? null,
  };
}

export const setBillingOverride = mutation({
  args: {
    customerId: v.id("users"),
    type: OVERRIDE_TYPE,
    /** % for "discounted" (1–100), cents for "custom", ignored for "free". */
    value: v.optional(v.number()),
    reason: v.string(),
    /** Optional unix-ms expiry. After this point the override no-ops. */
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const reason = args.reason.trim();
    if (!reason) throw new Error("REASON_REQUIRED");
    if (reason.length > 500) throw new Error("REASON_TOO_LONG");

    if (args.type === "discounted") {
      if (
        typeof args.value !== "number" ||
        !Number.isFinite(args.value) ||
        args.value <= 0 ||
        args.value > 100
      ) {
        throw new Error("DISCOUNT_PERCENT_REQUIRED");
      }
    }
    if (args.type === "custom") {
      if (
        typeof args.value !== "number" ||
        !Number.isFinite(args.value) ||
        args.value < 0
      ) {
        throw new Error("CUSTOM_AMOUNT_REQUIRED");
      }
    }
    if (
      typeof args.expiresAt === "number" &&
      args.expiresAt <= Date.now()
    ) {
      throw new Error("EXPIRES_AT_IN_PAST");
    }

    const before = snapshotOverride(target);
    const now = Date.now();
    await ctx.db.patch(args.customerId, {
      billingOverride: args.type,
      billingOverrideValue:
        args.type === "free" ? undefined : args.value,
      billingOverrideReason: reason,
      billingOverrideByUserId: actor._id,
      billingOverrideAt: now,
      billingOverrideExpiresAt: args.expiresAt ?? undefined,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: "BILLING_OVERRIDE_SET",
      entityType: "User",
      entityId: args.customerId as unknown as string,
      metadataJson: {
        before,
        after: {
          type: args.type,
          value: args.type === "free" ? null : args.value ?? null,
          reason,
          expiresAt: args.expiresAt ?? null,
        },
      },
      createdAt: now,
    });

    return { ok: true };
  },
});

export const clearBillingOverride = mutation({
  args: {
    customerId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const before = snapshotOverride(target);
    if (before.type === null) {
      // Idempotent — nothing to clear, but still write an audit row so
      // an OWNER's "I cleared this" intent is captured.
    }
    const now = Date.now();
    await ctx.db.patch(args.customerId, {
      billingOverride: undefined,
      billingOverrideValue: undefined,
      billingOverrideReason: undefined,
      billingOverrideByUserId: undefined,
      billingOverrideAt: undefined,
      billingOverrideExpiresAt: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: "BILLING_OVERRIDE_CLEARED",
      entityType: "User",
      entityId: args.customerId as unknown as string,
      metadataJson: {
        before,
        clearReason: args.reason ?? null,
      },
      createdAt: now,
    });
    return { ok: true };
  },
});

/**
 * Records that an admin attempted a payment recovery action. We do NOT
 * call Stripe directly from here — the admin uses the Stripe Dashboard
 * deep link rendered in Customer 360. This mutation just captures the
 * intent + a free-form note for the audit trail.
 */
export const logPaymentRecoveryAttempt = mutation({
  args: {
    customerId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    const target = await ctx.db.get(args.customerId);
    if (!target) throw new Error("USER_NOT_FOUND");
    const note = (args.note ?? "").trim().slice(0, 500) || null;
    await ctx.db.insert("auditLogs", {
      targetUserId: args.customerId,
      actorUserId: actor._id,
      action: "BILLING_PAYMENT_RECOVERY_ATTEMPT",
      entityType: "User",
      entityId: args.customerId as unknown as string,
      metadataJson: { note },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
