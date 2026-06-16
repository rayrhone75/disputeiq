// Payment-provider selection for one-time (packet) charges.
//
// Square is the PRIMARY provider; Stripe is the optional fallback used when
// Square isn't configured. Subscriptions are handled separately and always
// run on Stripe (see lib/stripe-subscriptions.ts). Keeping the choice in one
// place means the checkout route and any future caller agree on the rule.

import { squareConfigured } from "@/lib/square";

export type PaymentProvider = "SQUARE" | "STRIPE";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Choose the provider for a one-time charge: Square first, then Stripe.
 * Returns null when neither is configured (caller should surface a clear
 * "payments unavailable" error rather than crash).
 */
export function selectPaymentProvider(): PaymentProvider | null {
  if (squareConfigured()) return "SQUARE";
  if (stripeConfigured()) return "STRIPE";
  return null;
}
