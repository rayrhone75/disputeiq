// Stripe client wrapper.
//
// Single shared `Stripe` instance lazily initialized from `STRIPE_SECRET_KEY`.
// All higher-level Stripe helpers (lib/stripe-subscriptions.ts,
// lib/stripe-checkout.ts) and the webhook route import `getStripe()` from
// here so we never instantiate the client twice.
//
// Webhook signature verification lives here too — it's a thin wrapper around
// `stripe.webhooks.constructEvent` that throws a typed error if the
// signature header is missing or invalid.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env (test mode key starts with sk_test_).",
    );
  }
  _stripe = new Stripe(key, {
    // Pin the API version so Stripe-side schema changes don't surprise us.
    // Bump deliberately when we want new fields.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return _stripe;
}

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

/**
 * Verify a webhook payload using `stripe.webhooks.constructEvent`. Returns
 * the parsed Stripe.Event on success; throws StripeSignatureError otherwise.
 *
 * `rawBody` MUST be the exact bytes Stripe POSTed — do not parse JSON
 * upstream. In a Next.js App Router route, use `await req.text()`.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeSignatureError("STRIPE_WEBHOOK_SECRET not set");
  if (!signatureHeader) throw new StripeSignatureError("Missing stripe-signature header");
  try {
    return getStripe().webhooks.constructEvent(rawBody, signatureHeader, secret);
  } catch (err) {
    throw new StripeSignatureError(
      `Stripe signature verification failed: ${(err as Error).message}`,
    );
  }
}
