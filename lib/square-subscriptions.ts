// LEGACY (replaced by Stripe Subscriptions on 2026-04-27).
//
// Stripe is now the live subscription provider — see `lib/stripe-subscriptions.ts`.
// This file is kept on disk for revive-ability; nothing in the live flow
// imports it. Safe to delete in a future cleanup pass.
//
// Square Subscriptions API integration.
// Creates recurring subscriptions, manages customers, handles lifecycle events.
// Requires: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_PLAN_VARIATION_*
import crypto from "node:crypto";

const SQUARE_BASE = process.env.SQUARE_API_BASE ?? "https://connect.squareup.com";
const SQUARE_VERSION = "2024-10-17";

function headers() {
  return {
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN ?? ""}`,
    "Content-Type": "application/json",
    "Square-Version": SQUARE_VERSION,
  };
}

// Plan variation IDs — set these in env after creating plans in Square Dashboard
export const PLAN_VARIATIONS: Record<string, string> = {
  starter: process.env.SQUARE_PLAN_VARIATION_STARTER ?? "",
  pro: process.env.SQUARE_PLAN_VARIATION_PRO ?? "",
  elite: process.env.SQUARE_PLAN_VARIATION_ELITE ?? "",
};

// ─── Customer management ────────────────────────────────────────────────────

export async function getOrCreateSquareCustomer(
  userId: string,
  email: string,
  fullName?: string,
): Promise<string> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return `mock_customer_${userId}`;

  // Search for existing customer by email
  const searchRes = await fetch(`${SQUARE_BASE}/v2/customers/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query: { filter: { email_address: { exact: email } } },
    }),
  });
  const searchData = await searchRes.json();
  const existing = searchData?.customers?.[0];
  if (existing?.id) return existing.id;

  // Create new customer
  const createRes = await fetch(`${SQUARE_BASE}/v2/customers`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      email_address: email,
      given_name: fullName?.split(" ")[0] ?? "",
      family_name: fullName?.split(" ").slice(1).join(" ") ?? "",
      reference_id: userId,
    }),
  });
  const createData = await createRes.json();
  return createData?.customer?.id ?? `sq_cust_${userId}`;
}

// ─── Subscription creation ──────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  customerId: string;
  planCode: "starter" | "pro" | "elite";
  locationId?: string;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  status: string;
  startDate?: string;
  chargedThroughDate?: string;
  raw?: unknown;
}

export async function createSquareSubscription(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = input.locationId ?? process.env.SQUARE_LOCATION_ID ?? "";
  const planVariationId = PLAN_VARIATIONS[input.planCode];

  if (!token || !planVariationId) {
    // Mock fallback for dev
    return {
      subscriptionId: `mock_sub_${Date.now()}`,
      status: "ACTIVE",
      startDate: new Date().toISOString().slice(0, 10),
      chargedThroughDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    };
  }

  const res = await fetch(`${SQUARE_BASE}/v2/subscriptions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      location_id: locationId,
      plan_variation_id: planVariationId,
      customer_id: input.customerId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Square subscription failed: ${res.status} ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  const sub = data?.subscription;
  return {
    subscriptionId: sub?.id ?? `sq_sub_${Date.now()}`,
    status: sub?.status ?? "ACTIVE",
    startDate: sub?.start_date,
    chargedThroughDate: sub?.charged_through_date,
    raw: data,
  };
}

// ─── Subscription cancellation ──────────────────────────────────────────────

export async function cancelSquareSubscription(subscriptionId: string): Promise<boolean> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token || subscriptionId.startsWith("mock_")) return true;

  const res = await fetch(`${SQUARE_BASE}/v2/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });
  return res.ok;
}
