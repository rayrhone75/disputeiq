export function getLetterPricing(params: {
  isGraceUser: boolean;
  softwareFeeCents?: number;
  mailingFeeCents?: number;
}) {
  const softwareFee = params.isGraceUser ? 0 : params.softwareFeeCents ?? 1900;
  const mailingFee = params.mailingFeeCents ?? 1295;
  return { softwareFee, mailingFee, total: softwareFee + mailingFee };
}
