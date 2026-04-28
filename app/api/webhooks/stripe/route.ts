import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { verifyStripeSignature, StripeSignatureError } from "@/lib/stripe";
import { enqueue } from "@/lib/queue";
import { ensureJobHandlers } from "@/lib/jobs/register";
import { PLANS, type PlanCode } from "@/lib/billing/plans";

ensureJobHandlers();

// Public Stripe webhook. Verify HMAC against the raw body, then forward
// parsed events into Convex via system-secret-guarded mutations.
//
// Events handled:
//   - checkout.session.completed (mode=subscription)  → record subscription
//   - checkout.session.completed (mode=payment)       → record packet payment
//   - customer.subscription.{created,updated,deleted} → status patch
//   - invoice.payment_succeeded                       → renewal
//   - invoice.payment_failed                          → past_due
//
// Anything else returns 200 with `{ ignored: true }` so Stripe doesn't retry
// for events we don't care about.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeSignature(raw, sig);
  } catch (err) {
    if (err instanceof StripeSignatureError) {
      return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
    }
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleSubscriptionCheckoutCompleted(session, event.type, secret);
        } else if (session.mode === "payment") {
          await handlePacketPaymentCompleted(session, secret);
        }
        return NextResponse.json({ ok: true });
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionLifecycle(sub, event.type, secret);
        return NextResponse.json({ ok: true });
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice, event.type, secret);
        return NextResponse.json({ ok: true });
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice, event.type, secret);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (err) {
    // Don't 500 on Stripe — log and ack so it stops retrying. Convex-side
    // failures should surface in our logs separately.
    console.error("[stripe webhook]", event.type, (err as Error).message);
    return NextResponse.json({ ok: true, error: (err as Error).message });
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventType: string,
  secret: string,
) {
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!stripeSubscriptionId || !stripeCustomerId) return;

  const planCode = (session.metadata?.planCode ?? null) as PlanCode | null;
  const planMeta = planCode ? PLANS[planCode] : null;

  await fetchMutation(api.subscriptions.recordStripeEvent, {
    secret,
    kind: "checkout_completed",
    eventType,
    stripeSubscriptionId,
    stripeCustomerId,
    stripeStatus: "active",
    planCode: planCode ?? undefined,
    includedPackets: planMeta?.includedPackets,
    overagePacketPriceCents: planMeta?.overagePacketPriceCents,
  });
}

async function handleSubscriptionLifecycle(
  sub: Stripe.Subscription,
  eventType: string,
  secret: string,
) {
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Stripe types `current_period_start/end` as number on the live API even
  // when the SDK marks them optional. Cast through unknown to avoid a `any`.
  const periods = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  const planCode = (sub.metadata?.planCode ?? null) as PlanCode | null;
  const planMeta = planCode ? PLANS[planCode] : null;

  await fetchMutation(api.subscriptions.recordStripeEvent, {
    secret,
    kind: "subscription_event",
    eventType,
    stripeSubscriptionId: sub.id,
    stripeCustomerId,
    stripeStatus: sub.status,
    currentPeriodStart: periods.current_period_start,
    currentPeriodEnd: periods.current_period_end,
    planCode: planCode ?? undefined,
    includedPackets: planMeta?.includedPackets,
    overagePacketPriceCents: planMeta?.overagePacketPriceCents,
  });
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  eventType: string,
  secret: string,
) {
  const inv = invoice as unknown as {
    customer: string | { id: string };
    subscription?: string | { id: string } | null;
    period_start?: number;
    period_end?: number;
  };
  const stripeCustomerId =
    typeof inv.customer === "string" ? inv.customer : inv.customer.id;
  const stripeSubscriptionId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : inv.subscription?.id;
  if (!stripeCustomerId) return;

  await fetchMutation(api.subscriptions.recordStripeEvent, {
    secret,
    kind: "invoice_payment_succeeded",
    eventType,
    stripeSubscriptionId,
    stripeCustomerId,
    currentPeriodStart: inv.period_start,
    currentPeriodEnd: inv.period_end,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  eventType: string,
  secret: string,
) {
  const inv = invoice as unknown as {
    customer: string | { id: string };
    subscription?: string | { id: string } | null;
  };
  const stripeCustomerId =
    typeof inv.customer === "string" ? inv.customer : inv.customer.id;
  const stripeSubscriptionId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : inv.subscription?.id;
  if (!stripeCustomerId) return;

  await fetchMutation(api.subscriptions.recordStripeEvent, {
    secret,
    kind: "invoice_payment_failed",
    eventType,
    stripeSubscriptionId,
    stripeCustomerId,
  });
}

async function handlePacketPaymentCompleted(
  session: Stripe.Checkout.Session,
  secret: string,
) {
  const paymentIntentRef = session.client_reference_id;
  const stripePaymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentRef || !stripePaymentId) return;

  type PaymentResult = {
    matched: boolean;
    idempotent?: boolean;
    disputeCaseId?: Id<"disputeCases"> | null;
  };
  let result: PaymentResult | null = null;
  try {
    result = (await fetchMutation(api.payments.recordStripePayment, {
      secret,
      paymentIntentId: paymentIntentRef as Id<"paymentIntents">,
      providerPaymentId: stripePaymentId,
    })) as PaymentResult;
  } catch {
    return;
  }
  if (!result || !result.matched || result.idempotent) return;

  if (result.disputeCaseId) {
    await enqueue({
      name: "dispatch-letter",
      payload: { disputeCaseId: result.disputeCaseId as unknown as string },
    });
  }
}
