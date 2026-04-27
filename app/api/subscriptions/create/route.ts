import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PLANS, type PlanCode } from "@/lib/billing/plans";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
} from "@/lib/stripe-subscriptions";

// Subscription creation via Stripe hosted Checkout.
//
// Flow:
//   1. Validate plan code, ensure no active subscription.
//   2. Get/create Stripe customer (keyed off Clerk user id metadata).
//   3. Create a Stripe Checkout Session (mode=subscription).
//   4. Pre-stamp a `pending` userSubscriptions row with stripeCustomerId so
//      the webhook can match by customer even before the subscription id
//      lands.
//   5. Return { checkoutUrl } — the client redirects to Stripe.
//
// Stripe creates the actual subscription server-side and fires
// `checkout.session.completed` + `customer.subscription.created`. Our
// webhook patches the row to `active` + stamps `stripeSubscriptionId`.
const schema = z.object({
  planCode: z.enum(["starter", "pro", "elite"]),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const planCode = parsed.data.planCode as PlanCode;
  const plan = PLANS[planCode];

  const existing = await fetchQuery(api.subscriptions.getForUser, {}, { token });
  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "ALREADY_SUBSCRIBED", plan: existing.planCode },
      { status: 409 },
    );
  }

  const profile = await fetchQuery(api.profile.getMine, {}, { token });
  const u = await currentUser();
  const email =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress ??
    "";

  let stripeCustomerId: string;
  try {
    stripeCustomerId = await getOrCreateStripeCustomer({
      clerkUserId: userId,
      email,
      fullName: profile?.fullName ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "STRIPE_CUSTOMER_FAILED", message: (err as Error).message },
      { status: 502 },
    );
  }

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const successUrl = `${base}/dashboard?subscribed=1&plan=${planCode}`;
  const cancelUrl = `${base}/dashboard/onboarding?canceled=1`;

  let checkout: { url: string; sessionId: string };
  try {
    checkout = await createSubscriptionCheckoutSession({
      customerId: stripeCustomerId,
      planCode,
      successUrl,
      cancelUrl,
      clerkUserId: userId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "STRIPE_CHECKOUT_FAILED", message: (err as Error).message },
      { status: 502 },
    );
  }

  // Pre-stamp a pending row so the customer-portal button has a customer id
  // to talk to, and so the webhook can find this subscription by customer
  // even if `stripeSubscriptionId` lookup misses on the first event.
  const now = Date.now();
  await fetchMutation(
    api.subscriptions.upsertForUser,
    {
      planCode,
      status: "pending",
      cycleStart: now,
      cycleEnd: now + 30 * 86400000,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
      stripeCustomerId,
    },
    { token },
  );

  return NextResponse.json({
    checkoutUrl: checkout.url,
    sessionId: checkout.sessionId,
    planCode,
  });
}
