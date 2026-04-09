// Pricing — flat $12.95 per dispute packet (per bureau).
// One packet may contain unlimited disputed tradelines for that bureau.
// Software fee is folded into the flat price; grace users pay $0.
//
// Example: 40 disputed items split across all 3 bureaus = 3 packets = $38.85.
// NEVER per-account, NEVER per-letter.

export const PACKET_PRICE_CENTS = 1295;

export function getLetterPricing(params: {
  isGraceUser: boolean;
  softwareFeeCents?: number; // legacy param — ignored, kept for callsite compatibility
  mailingFeeCents?: number; // legacy param — ignored
}) {
  if (params.isGraceUser) {
    return { softwareFee: 0, mailingFee: 0, total: 0 };
  }
  return { softwareFee: 0, mailingFee: PACKET_PRICE_CENTS, total: PACKET_PRICE_CENTS };
}

export function getPacketPricing(packets: number, isGraceUser: boolean) {
  if (isGraceUser) return { perPacketCents: 0, packets, totalCents: 0 };
  return {
    perPacketCents: PACKET_PRICE_CENTS,
    packets,
    totalCents: PACKET_PRICE_CENTS * packets,
  };
}
