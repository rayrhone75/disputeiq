// Packet usage calculation for the current billing cycle.
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PLANS, type PlanCode } from "./plans";

export function getIncludedPackets(planCode: PlanCode) {
  return PLANS[planCode].includedPackets;
}

export function getOveragePacketPrice(planCode: PlanCode) {
  return PLANS[planCode].overagePacketPriceCents;
}

export function getPacketChargeCents(
  planCode: PlanCode,
  usedPacketsThisCycle: number,
) {
  const included = getIncludedPackets(planCode);
  if (usedPacketsThisCycle < included) return 0;
  return getOveragePacketPrice(planCode);
}

export function createPacketCharge(input: {
  planCode: PlanCode;
  packetsUsedThisCycle: number;
}) {
  const chargeCents = getPacketChargeCents(
    input.planCode,
    input.packetsUsedThisCycle,
  );
  return {
    chargeCents,
    included: chargeCents === 0,
    label: chargeCents === 0 ? "Included in plan" : "Extra packet",
  };
}

export type PacketUsage = {
  plan: PlanCode | null;
  included: number;
  used: number;
  remaining: number;
  overagePriceCents: number;
};

/**
 * Get the current billing cycle packet usage for the calling user.
 * Reads via the Convex `subscriptions.usageForUser` query.
 */
export async function getUserPacketUsage(): Promise<PacketUsage> {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) {
    return {
      plan: null,
      included: 0,
      used: 0,
      remaining: 0,
      overagePriceCents: 1995,
    };
  }
  const usage = (await fetchQuery(
    api.subscriptions.usageForUser,
    {},
    { token },
  )) as {
    plan: string | null;
    included: number;
    used: number;
    remaining: number;
    overagePriceCents: number;
  };
  return {
    plan: (usage.plan as PlanCode | null) ?? null,
    included: usage.included,
    used: usage.used,
    remaining: usage.remaining,
    overagePriceCents: usage.overagePriceCents,
  };
}
