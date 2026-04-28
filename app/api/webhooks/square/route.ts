import { NextResponse } from "next/server";

// LEGACY (replaced by Stripe webhooks on 2026-04-27).
//
// Stripe is now the live payment provider; webhooks land at
// `/api/webhooks/stripe`. This route stays mounted so any stale Square
// webhook configuration returns a clean 410 Gone instead of 404. Remove the
// route entirely once the Square webhook subscription has been deleted in
// the Square Dashboard.
export async function POST() {
  return NextResponse.json(
    {
      error: "GONE",
      message:
        "Square integration retired. Active webhook is /api/webhooks/stripe.",
    },
    { status: 410 },
  );
}
