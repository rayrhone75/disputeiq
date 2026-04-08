/**
 * MyFreeScore integration scaffold.
 *
 * This file is intentionally a typed seam, not a live integration.
 * The UI rebuild ships first; flip ENABLED to true and fill in the
 * link builder + webhook handler when MyFreeScore credentials are
 * provisioned.
 *
 * Goals of this seam:
 *  - Onboarding can already render a "Connect MyFreeScore" step.
 *  - Future report import / refresh hooks have a single place to land.
 *  - No runtime dependency until ENABLED flips on.
 */

export const MYFREESCORE = {
  ENABLED: false,
  AFFILIATE_ID: process.env.MYFREESCORE_AFFILIATE_ID ?? "",
  BASE_URL: "https://www.myfreescorenow.com",
} as const;

export type MyFreeScorePersonalLinkInput = {
  /** DisputeIQ user id — round-tripped via subId for attribution. */
  userId: string;
  /** Optional campaign tag for analytics. */
  campaign?: string;
};

/**
 * Build a personalized signup link. Returns null when integration is disabled
 * or affiliate id is unset, so callers can fall back to a generic CTA.
 */
export function buildMyFreeScoreLink(input: MyFreeScorePersonalLinkInput): string | null {
  if (!MYFREESCORE.ENABLED || !MYFREESCORE.AFFILIATE_ID) return null;
  const url = new URL("/signup", MYFREESCORE.BASE_URL);
  url.searchParams.set("aid", MYFREESCORE.AFFILIATE_ID);
  url.searchParams.set("subId", input.userId);
  if (input.campaign) url.searchParams.set("c", input.campaign);
  return url.toString();
}

/**
 * Future seam: when a webhook or polling job confirms a user has connected
 * MyFreeScore, drop the inbound report payload here. For now this is a
 * placeholder so callers compile.
 */
export type MyFreeScoreReportPayload = {
  userId: string;
  pulledAt: string;
  /** Raw report blob — shape will be defined alongside the parser. */
  raw: unknown;
};

export async function ingestMyFreeScoreReport(_payload: MyFreeScoreReportPayload): Promise<void> {
  if (!MYFREESCORE.ENABLED) return;
  // TODO: persist the report, kick off the cross-bureau analyzer, then
  // surface a notification on the user's dashboard.
}
