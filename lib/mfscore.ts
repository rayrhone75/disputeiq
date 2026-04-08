// MyFreeScoreNow affiliate adapter. Real API requires credentials.
export function getMfsnAffiliateLink(userId: string) {
  const base = process.env.MFSN_AFFILIATE_LINK ?? "https://example.com/mfsn";
  const cb = process.env.MFSN_CALLBACK_URL ?? "";
  const url = new URL(base);
  url.searchParams.set("ref", userId);
  if (cb) url.searchParams.set("callback", cb);
  return url.toString();
}

export async function syncMfsnReport(_userId: string) {
  // TODO: pull report via MFSN API
  return null;
}
