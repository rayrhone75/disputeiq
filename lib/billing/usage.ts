// Packet usage calculation for the current billing cycle.
import { PLANS, type PlanCode } from "./plans";
import { prisma } from "@/lib/prisma";

export function getIncludedPackets(planCode: PlanCode) {
  return PLANS[planCode].includedPackets;
}

export function getOveragePacketPrice(planCode: PlanCode) {
  return PLANS[planCode].overagePacketPriceCents;
}

export function getPacketChargeCents(planCode: PlanCode, usedPacketsThisCycle: number) {
  const included = getIncludedPackets(planCode);
  if (usedPacketsThisCycle < included) return 0;
  return getOveragePacketPrice(planCode);
}

export function createPacketCharge(input: {
  planCode: PlanCode;
  packetsUsedThisCycle: number;
}) {
  const chargeCents = getPacketChargeCents(input.planCode, input.packetsUsedThisCycle);
  return {
    chargeCents,
    included: chargeCents === 0,
    label: chargeCents === 0 ? "Included in plan" : "Extra packet",
  };
}

// Get the current billing cycle packet usage for a user.
export async function getUserPacketUsage(userId: string) {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } }).catch(() => null);
  if (!sub || sub.status !== "active") {
    return { plan: null, included: 0, used: 0, remaining: 0, overagePriceCents: 1995 };
  }
  const planCode = sub.planCode as PlanCode;
  const plan = PLANS[planCode];
  const used = await prisma.disputeCase.count({
    where: {
      userId,
      status: { in: ["PAID", "MAILED", "DELIVERED", "RESPONSE_RECEIVED", "CLOSED"] },
      mailedAt: { gte: sub.cycleStart },
    },
  });
  const remaining = Math.max(0, plan.includedPackets - used);
  return {
    plan: planCode,
    included: plan.includedPackets,
    used,
    remaining,
    overagePriceCents: plan.overagePacketPriceCents,
  };
}
