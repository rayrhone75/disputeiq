import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PLANS, type PlanCode } from "@/lib/billing/plans";
import {
  getOrCreateSquareCustomer,
  createSquareSubscription,
} from "@/lib/square-subscriptions";

// Real recurring subscription via Square Subscriptions API.
// Creates a Square customer, then a subscription with the plan variation.
// Square handles recurring billing. Webhook events keep UserSubscription in sync.
const schema = z.object({
  planCode: z.enum(["starter", "pro", "elite"]),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const planCode = parsed.data.planCode as PlanCode;
  const plan = PLANS[planCode];

  const existing = await fetchQuery(
    api.subscriptions.getForUser,
    {},
    { token },
  );
  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "ALREADY_SUBSCRIBED", plan: existing.planCode },
      { status: 409 },
    );
  }

  const profile = await fetchQuery(api.profile.getMine, {}, { token });
  const u = await currentUser();
  const email =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress ??
    "";

  const squareCustomerId = await getOrCreateSquareCustomer(
    userId,
    email,
    profile?.fullName ?? undefined,
  );

  const result = await createSquareSubscription({
    customerId: squareCustomerId,
    planCode,
  });

  const now = Date.now();
  const cycleEnd = result.chargedThroughDate
    ? new Date(result.chargedThroughDate).getTime()
    : now + 30 * 86400000;

  const subId = await fetchMutation(
    api.subscriptions.upsertForUser,
    {
      planCode,
      status: result.status === "ACTIVE" ? "active" : "pending",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
      squareSubscriptionId: result.subscriptionId,
    },
    { token },
  );

  return NextResponse.json({
    subscriptionId: subId,
    squareSubscriptionId: result.subscriptionId,
    status: result.status === "ACTIVE" ? "active" : "pending",
    planCode,
  });
}
