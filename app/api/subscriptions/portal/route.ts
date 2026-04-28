import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { createBillingPortalSession } from "@/lib/stripe-subscriptions";

// Stripe Customer Portal — replaces our old `/api/subscriptions/cancel`
// endpoint with a single self-service surface that handles cancel, payment
// method updates, and invoice history. Stripe fires
// `customer.subscription.deleted` if the user cancels; our webhook flips the
// local row to `canceled`.
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const sub = await fetchQuery(api.subscriptions.getForUser, {}, { token });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "NO_STRIPE_CUSTOMER", message: "Subscribe before opening the billing portal." },
      { status: 404 },
    );
  }

  const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const returnUrl = `${base}/dashboard`;

  try {
    const { url } = await createBillingPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl,
    });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: "STRIPE_PORTAL_FAILED", message: (err as Error).message },
      { status: 502 },
    );
  }
}
