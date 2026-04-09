import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PLANS, type PlanCode } from "@/lib/billing/plans";
import { createSquareCheckout } from "@/lib/square";
import { writeAuditLog } from "@/lib/audit";

// Plan subscription checkout. Creates a UserSubscription record + Square
// payment link for the first month. Square webhook marks it active on payment.
// For now this is a one-time checkout per plan month (not Square recurring
// subscriptions API) — simple, works, upgradeable later.
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

  // Check for existing active subscription
  const existing = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (existing?.status === "active") {
    return NextResponse.json({ error: "ALREADY_SUBSCRIBED", plan: existing.planCode }, { status: 409 });
  }

  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  // Upsert subscription as pending (activated by Square webhook on payment)
  const sub = await prisma.userSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planCode,
      status: "pending",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
    },
    update: {
      planCode,
      status: "pending",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan.includedPackets,
      overagePacketPriceCents: plan.overagePacketPriceCents,
    },
  });

  // Create a payment intent for the first month
  const payment = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      provider: "SQUARE",
      amountCents: plan.monthlyPriceCents,
      description: `${plan.name} plan — first month`,
    },
  });

  const checkout = await createSquareCheckout({
    amountCents: plan.monthlyPriceCents,
    referenceId: payment.id,
    description: payment.description,
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "SUBSCRIPTION_CHECKOUT_CREATED",
    entityType: "UserSubscription",
    entityId: sub.id,
    metadataJson: { planCode, amountCents: plan.monthlyPriceCents },
  });

  return NextResponse.json({
    subscriptionId: sub.id,
    paymentId: payment.id,
    checkoutUrl: checkout.checkoutUrl,
  });
}
