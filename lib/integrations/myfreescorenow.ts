/**
 * MyFreeScoreNow integration module.
 *
 * Phase A: manual affiliate funnel.
 *   - Centralized enrollment URL + affiliate tag.
 *   - Helpers the UI uses so the link never gets pasted inline anywhere.
 *   - Stub return/intake contract so the rest of the app can already depend on
 *     stable shapes before any real API exists.
 *
 * Future phases (not implemented here):
 *   - Automated report pull + re-pull via MFSN API (when credentials exist)
 *   - Diff between pulls (report snapshots stored per user)
 *   - Webhook ingestion to keep the activity timeline in sync
 *
 * Branding rule:
 *   MyFreeScoreNow lives inside the Screwed Up Credit ecosystem.
 *   DisputeIQ is the primary product surface; MFSN is the report intake lane.
 */

export const MYFREESCORENOW = {
  affiliateTag: "B01B4735",
  enrollUrl: "https://app.myfreescorenow.com/enroll/B01B4735",
  parentBrand: "Screwed Up Credit",
  productName: "MyFreeScoreNow",
  /**
   * Short marketing label shown next to the CTA. Keep it under ~40 chars.
   */
  ctaLabel: "Get your 3-bureau report →",
  /**
   * Neutral, non-promissory descriptor for compliance copy.
   */
  descriptor:
    "MyFreeScoreNow is the 3-bureau report intake provider in the Screwed Up Credit ecosystem.",
} as const;

/**
 * Canonical enrollment URL. Use this everywhere instead of hardcoding.
 * When MFSN adds per-session tracking, add params here in one place.
 */
export function getEnrollUrl(opts?: {
  /** internal campaign identifier — does not leak PII */
  campaign?: string;
  /** where the user was on disputeiq.org when they clicked */
  source?: string;
}) {
  const url = new URL(MYFREESCORENOW.enrollUrl);
  if (opts?.campaign) url.searchParams.set("utm_campaign", opts.campaign);
  if (opts?.source) url.searchParams.set("utm_source", opts.source);
  return url.toString();
}

/**
 * Stable contract the rest of the app can depend on today, even though it's
 * populated manually until an MFSN API or webhook lands.
 */
export type MfsnReportSnapshot = {
  provider: "myfreescorenow";
  pulledAt: string;            // ISO timestamp
  bureaus: ("experian" | "equifax" | "transunion")[];
  /** opaque user identifier provided by MFSN (or our own id for manual uploads) */
  externalId: string;
  /** storage key of the raw report file in our vault */
  vaultKey: string;
};

export type MfsnIntakeStatus =
  | "not_started"
  | "awaiting_return"
  | "report_uploaded"
  | "report_linked"
  | "failed";

/**
 * Placeholder for future automated intake. Currently returns "not_started"
 * so call sites can already wire themselves up.
 */
export async function getIntakeStatus(_userId: string): Promise<MfsnIntakeStatus> {
  return "not_started";
}

/**
 * Placeholder for future MFSN refresh/re-pull. Throws until credentials exist.
 */
export async function requestRefresh(_userId: string): Promise<never> {
  throw new Error(
    "MyFreeScoreNow automated refresh not yet available. Manual re-upload is the Phase A path."
  );
}
