import { NextResponse } from "next/server";

// LEGACY (replaced by Stripe Customer Portal on 2026-04-27).
//
// Cancellation now happens inside Stripe's hosted Customer Portal, accessed
// via POST /api/subscriptions/portal. Stripe fires
// `customer.subscription.deleted`, our webhook flips the local row to
// `canceled` — so this route is no longer needed by the live flow.
//
// Kept on disk so any older client code that still calls it gets a clear
// 410 Gone response (rather than a 404) and a pointer to the new endpoint.
export async function POST() {
  return NextResponse.json(
    {
      error: "GONE",
      message:
        "Subscription cancel is now handled via the Stripe Customer Portal. POST /api/subscriptions/portal to get a portal URL.",
      portal: "/api/subscriptions/portal",
    },
    { status: 410 },
  );
}
