// One-time Stripe Checkout sessions for overage packet charges.
//
// Mirrors `createSquareCheckout` in `lib/square.ts`. We use Stripe Checkout's
// `mode: "payment"` with `price_data` defined inline so we don't need to
// pre-create a Stripe Product/Price for ad-hoc charges.

import { getStripe } from "./stripe";

export async function createStripeCheckoutSession(input: {
  amountCents: number;
  referenceId: string; // our paymentIntents._id — used to reconcile in webhook
  description: string;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const stripe = getStripe();
  const base = process.env.APP_BASE_URL ?? "";
  const successUrl =
    input.successUrl ??
    `${base}/dashboard/disputes?paid=1&intent=${encodeURIComponent(input.referenceId)}`;
  const cancelUrl = input.cancelUrl ?? `${base}/dashboard/disputes?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: input.customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: input.description.slice(0, 250) },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // The webhook reads `client_reference_id` to find our paymentIntents row.
    client_reference_id: input.referenceId,
    payment_intent_data: {
      metadata: { paymentIntentId: input.referenceId },
    },
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return { checkoutUrl: session.url, sessionId: session.id };
}
