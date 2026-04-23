/**
 * MyFreeScoreNow integration module — LEGACY.
 *
 * MFSN was the previous report-intake partner. DisputeIQ has moved to
 * IdentityIQ (IDIQ) as the supported provider for every new customer.
 *
 * This module stays only to:
 *   - keep historical `ReportSource.MYFREESCORENOW` rows readable
 *   - avoid breaking any legacy imports in marketing/admin surfaces that
 *     have not yet been cut over
 *
 * Do NOT use this for new customer-facing flows. Use
 * `lib/integrations/identityiq.ts` instead.
 *
 * @deprecated Use `lib/integrations/identityiq.ts`. Slated for removal once
 * all UI surfaces have migrated.
 */

export const MYFREESCORENOW = {
  affiliateTag: "B01B4735",
  enrollUrl: "https://app.myfreescorenow.com/enroll/B01B4735",
  parentBrand: "Screwed Up Credit",
  productName: "MyFreeScoreNow",
  ctaLabel: "Get your 3-bureau report →",
  descriptor:
    "MyFreeScoreNow was the legacy report-intake provider. DisputeIQ now uses IdentityIQ (IDIQ) as the supported provider for new customers.",
  /** When true, any legacy callers that reach this module receive empty URLs. */
  retired: true,
} as const;

/** @deprecated Use `buildIdiqEnrollUrl` from `lib/integrations/identityiq.ts`. */
export function getEnrollUrl(opts?: { campaign?: string; source?: string }): string {
  // Preserve behavior for any legacy callers still in the tree. Prefer not to
  // encourage new use — the string is intentionally left intact so admin
  // support tooling can still link back for historical context.
  const url = new URL(MYFREESCORENOW.enrollUrl);
  if (opts?.campaign) url.searchParams.set("utm_campaign", opts.campaign);
  if (opts?.source) url.searchParams.set("utm_source", opts.source);
  return url.toString();
}

export type MfsnReportSnapshot = {
  provider: "myfreescorenow";
  pulledAt: string;
  bureaus: ("experian" | "equifax" | "transunion")[];
  externalId: string;
  vaultKey: string;
};

export type MfsnIntakeStatus =
  | "not_started"
  | "awaiting_return"
  | "report_uploaded"
  | "report_linked"
  | "failed";

/** @deprecated MFSN is retired; always returns "not_started" now. */
export async function getIntakeStatus(_userId: string): Promise<MfsnIntakeStatus> {
  return "not_started";
}

/** @deprecated MFSN is retired; throws on call. */
export async function requestRefresh(_userId: string): Promise<never> {
  throw new Error(
    "MyFreeScoreNow is retired. Use the IdentityIQ flow instead.",
  );
}
