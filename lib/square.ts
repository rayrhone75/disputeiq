// Square payment adapter — PRIMARY one-time payment provider.
//
// Handles overage "packet" charges via the Square Checkout (payment-links)
// API. Stripe (lib/stripe-checkout.ts) is the optional fallback when Square
// is not configured, and remains the provider for recurring subscriptions.
// Webhook reconciliation: we stamp our paymentIntents._id into the link's
// `payment_note`; Square echoes it back as `payment.note` on the
// payment.created / payment.updated webhook (see app/api/webhooks/square).
import crypto from "node:crypto";

// Pick the API host from SQUARE_ENVIRONMENT (production | sandbox); an explicit
// SQUARE_API_BASE always wins for self-hosted/proxy setups.
function squareBase(): string {
  if (process.env.SQUARE_API_BASE) return process.env.SQUARE_API_BASE;
  const env = (process.env.SQUARE_ENVIRONMENT ?? "production").toLowerCase();
  return env === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

/** True when Square is configured enough to create live checkouts. */
export function squareConfigured(): boolean {
  return Boolean(
    process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID,
  );
}

export async function createSquareCheckout(input: {
  amountCents: number;
  referenceId: string;
  description: string;
}): Promise<{ checkoutUrl: string; orderId?: string; paymentLinkId?: string }> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token || !locationId) {
    // Dev/local fallback so the flow is exercisable without credentials.
    return { checkoutUrl: `/mock-square-checkout/${input.referenceId}` };
  }

  const idempotencyKey = crypto.randomUUID();
  const base = process.env.APP_BASE_URL ?? "";
  const body = {
    idempotency_key: idempotencyKey,
    quick_pay: {
      name: input.description.slice(0, 80),
      price_money: { amount: input.amountCents, currency: "USD" },
      location_id: locationId,
    },
    checkout_options: {
      redirect_url: `${base}/dashboard/disputes?paid=1&intent=${encodeURIComponent(input.referenceId)}`,
    },
    // Echoed back as `payment.note` on the webhook → maps to our intent id.
    payment_note: input.referenceId,
  };

  const res = await fetch(`${squareBase()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-10-17",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Square checkout failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const url: string | undefined = data?.payment_link?.url;
  if (!url) throw new Error("Square returned no checkout URL");
  return {
    checkoutUrl: url,
    orderId: data?.payment_link?.order_id,
    paymentLinkId: data?.payment_link?.id,
  };
}

// Square webhook signature = base64( HMAC_SHA256( signatureKey,
// notificationUrl + rawBody ) ). The notificationUrl must EXACTLY match the
// URL registered in the Square dashboard — provide it via
// SQUARE_WEBHOOK_NOTIFICATION_URL, else we derive it from APP_BASE_URL.
export function squareNotificationUrl(): string {
  return (
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ??
    `${process.env.APP_BASE_URL ?? ""}/api/webhooks/square`
  );
}

export function verifySquareSignature(
  notificationUrl: string,
  rawBody: string,
  signature: string | null,
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;
  const hmac = crypto
    .createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}
