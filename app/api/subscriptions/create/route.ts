import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PLANS, type PlanCode } from "@/lib/billing/plans";
import { getOrCreateSquareCustomer, createSquareSubscription } from "@/lib/square-subscriptions";
import { writeAuditLog } from "@/lib/audit";

// Real recurring subscription via Square Subscriptions API.
// Creates a Square customer, then a subscription with the plan variation.
// Square handles recurring billing. Webhook events keep UserSubscription in sync.
const schema = z.object({
  planCode: z.enum(["starter", "pro", "elite"]),
});

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const planCode = parsed.data.planCode as PlanCode;
  const plan = PLANS[planCode];

  const existing = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (existing?.status === "active") {
    return NextResponse.json({ error: "ALREADY_SUBSCRIBED", plan: existing.planCode }, { status: 409 });
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  const squareCustomerId = await getOrCreateSquareCustomer(
    user.id,
    user.email,
    profile?.fullName,
  );

  const result = await createSquareSubscription({ customerId: squareCustomerId, planCode });

  const now = new Date();
  const cycleEnd = result.chargedThroughDate
    ? new Date(result.chargedThroughDate)
    : new Date(now.getTime() + 30 * 86400000);

  const sub = await prisma.userSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planCode,
      status: result.status === "ACTIVE" ? "active" : "pending",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
      squareSubscriptionId: result.subscriptionId,
    },
    update: {
      planCode,
      status: result.status === "ACTIVE" ? "active" : "pending",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
      squareSubscriptionId: result.subscriptionId,
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "SUBSCRIPTION_CREATED",
    entityType: "UserSubscription",
    entityId: sub.id,
    metadataJson: { planCode, squareSubscriptionId: result.subscriptionId, squareCustomerId },
  });

  return NextResponse.json({
    subscriptionId: sub.id,
    squareSubscriptionId: result.subscriptionId,
    status: sub.status,
    planCode,
  });
}
