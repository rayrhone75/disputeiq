// Legacy pricing module — redirects to the new billing source of truth.
// Kept for backwards-compatibility with any remaining callsites.
// The canonical pricing lives in lib/billing/plans.ts.

export { PLANS, PLAN_LIST, CREDIT_MONITORING, formatCents } from "@/lib/billing/plans";
export { PACKET_DEFINITION } from "@/lib/billing/packet-definition";
export { DISCLOSURES } from "@/lib/billing/disclosures";
export { getUserPacketUsage, getPacketChargeCents, createPacketCharge } from "@/lib/billing/usage";

// Legacy exports — some old callsites still reference these.
export const PACKET_PRICE_CENTS = 1995; // overage rate

export function getLetterPricing(_params: { isGraceUser: boolean }) {
  if (_params.isGraceUser) return { softwareFee: 0, mailingFee: 0, total: 0 };
  return { softwareFee: 0, mailingFee: 1995, total: 1995 };
}

export function getPacketPricing(packets: number, isGraceUser: boolean) {
  if (isGraceUser) return { perPacketCents: 0, packets, totalCents: 0 };
  return { perPacketCents: 1995, packets, totalCents: 1995 * packets };
}
