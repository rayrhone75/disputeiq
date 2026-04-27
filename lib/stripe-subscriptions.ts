// Stripe Subscriptions integration.
//
// Three operations that the Next.js layer needs:
//   1. getOrCreateStripeCustomer  — find a customer by Clerk user metadata
//      (fallback by email) and create one if missing.
//   2. createSubscriptionCheckoutSession — produce a hosted Stripe Checkout
//      URL the customer is redirected to. After they pay, Stripe creates the
//      subscription itself; our webhook flips the local row to `active`.
//   3. createBillingPortalSession  — produce a hosted Customer Portal URL
//      the customer uses to update payment method, cancel, view invoices.
//
// All `*_ID` constants are read from env at call time so Next.js dev hot
// reloads pick up `.env` changes without a full restart.

import type Stripe from "stripe";
import { getStripe } from "./stripe";
import type { PlanCode } from "./billing/plans";

export function stripePriceForPlan(planCode: PlanCode): string {
  const map: Record<PlanCode, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
  };
  const id = map[planCode];
  if (!id) {
    throw new Error(
      `STRIPE_PRICE_${planCode.toUpperCase()} is not set. Create the price in Stripe Dashboard and add price_… to .env.`,
    );
  }
  return id;
}

export async function getOrCreateStripeCustomer(input: {
  clerkUserId: string;
  email: string;
  fullName?: string;
}): Promise<string> {
  const stripe = getStripe();

  // Search first — Stripe's `search` API understands the metadata.X dot
  // syntax and is the canonical way to look up a customer by external id.
  const byMeta = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${input.clerkUserId}'`,
    limit: 1,
  });
  if (byMeta.data[0]) return byMeta.data[0].id;

  // Email fallback — covers customers created before metadata was stamped
  // (or via direct dashboard creation by support).
  if (input.email) {
    const byEmail = await stripe.customers.search({
      query: `email:'${input.email.replace(/'/g, "\\'")}'`,
      limit: 1,
    });
    if (byEmail.data[0]) {
      // Stamp the missing metadata so subsequent lookups are O(1).
      await stripe.customers.update(byEmail.data[0].id, {
        metadata: { clerkUserId: input.clerkUserId },
      });
      return byEmail.data[0].id;
    }
  }

  const created = await stripe.customers.create({
    email: input.email || undefined,
    name: input.fullName || undefined,
    metadata: { clerkUserId: input.clerkUserId },
  });
  return created.id;
}

export async function createSubscriptionCheckoutSession(input: {
  customerId: string;
  planCode: PlanCode;
  successUrl: string;
  cancelUrl: string;
  clerkUserId: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  const price = stripePriceForPlan(input.planCode);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Surface metadata on both the session AND the resulting subscription so
    // we can reconcile in the webhook even if customerId lookup misses.
    metadata: {
      planCode: input.planCode,
      clerkUserId: input.clerkUserId,
    },
    subscription_data: {
      metadata: {
        planCode: input.planCode,
        clerkUserId: input.clerkUserId,
      },
    },
    // Allow proration if the customer changes plans in-portal later.
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}

/**
 * Pull the current Stripe subscription. Useful after a checkout completes if
 * we need fresh state (e.g. period boundaries) before the webhook lands.
 */
export async function getStripeSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return await stripe.subscriptions.retrieve(subscriptionId);
}
