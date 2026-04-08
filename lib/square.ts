// Square adapter. Calls the live Checkout API when credentials are present;
// falls back to a mock checkout URL otherwise so local dev keeps working.
import crypto from "node:crypto";

const SQUARE_BASE = process.env.SQUARE_API_BASE ?? "https://connect.squareup.com";

export async function createSquareCheckout(input: {
  amountCents: number;
  referenceId: string;
  description: string;
}): Promise<{ checkoutUrl: string }> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!token || !locationId) {
    return { checkoutUrl: `/mock-square-checkout/${input.referenceId}` };
  }

  const idempotencyKey = crypto.randomUUID();
  const body = {
    idempotency_key: idempotencyKey,
    quick_pay: {
      name: input.description.slice(0, 80),
      price_money: { amount: input.amountCents, currency: "USD" },
      location_id: locationId,
    },
    checkout_options: {
      redirect_url: `${process.env.APP_BASE_URL ?? ""}/dashboard/disputes`,
    },
    payment_note: input.referenceId,
  };

  const res = await fetch(`${SQUARE_BASE}/v2/online-checkout/payment-links`, {
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
  return { checkoutUrl: url };
}

export function verifySquareSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;
  const hmac = crypto.createHmac("sha256", key).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}
