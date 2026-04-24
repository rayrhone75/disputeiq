// IdentityIQ (IDIQ) integration module — canonical customer-facing provider.
//
// Going forward, every new DisputeIQ customer is guided into their 3-bureau
// report through this integration. MyFreeScoreNow remains readable in legacy
// admin/support views but is no longer advertised to new users.
//
// Configuration values (affiliate URL, display copy, feature flags) live in
// the `platformSettings` Convex table so admins can rotate them without a
// deploy. `loadIdiqConfig` merges defaults ← env ← DB in that precedence
// order.

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const IDIQ = {
  productName: "IdentityIQ",
  shortName: "IDIQ",
  parentBrand: "DisputeIQ",
  ctaPrimary: "Continue with IDIQ",
  ctaSecondary: "Get your credit report",
  supportedNote:
    "IdentityIQ is the supported credit report provider for DisputeIQ. It delivers the tri-merge file DisputeIQ analyzes for disputes.",
} as const;

export const IDIQ_SETTING_KEYS = {
  affiliateUrl: "idiq.affiliateUrl",
  stageUrl: "idiq.stageUrl",
  displayName: "idiq.displayName",
  instructions: "idiq.instructions",
  disclaimer: "idiq.disclaimer",
  featureFlags: "idiq.featureFlags",
} as const;

export type IdiqConfig = {
  affiliateUrl: string;
  stageUrl: string | null;
  displayName: string;
  instructions: string;
  disclaimer: string;
  featureFlags: Record<string, boolean>;
};

const DEFAULT_INSTRUCTIONS = [
  "Click Continue with IDIQ to open IdentityIQ's enrollment page in a new tab.",
  "Complete the IdentityIQ signup and pull your 3-bureau report.",
  "Return to DisputeIQ — your workspace will be ready to import your report.",
].join("\n");

const DEFAULT_DISCLAIMER =
  "IdentityIQ is an independent third-party credit-monitoring service. DisputeIQ is a workflow tool — we do not guarantee outcomes or score changes. You can dispute inaccuracies yourself, for free, directly with the bureaus.";

function envDefaults(): IdiqConfig {
  return {
    affiliateUrl:
      process.env.IDIQ_AFFILIATE_URL ??
      process.env.NEXT_PUBLIC_IDIQ_AFFILIATE_URL ??
      "https://www.identityiq.com/securepreferred.aspx?offercode=431298HW",
    stageUrl: process.env.IDIQ_STAGE_URL ?? null,
    displayName: process.env.IDIQ_DISPLAY_NAME ?? IDIQ.productName,
    instructions: DEFAULT_INSTRUCTIONS,
    disclaimer: DEFAULT_DISCLAIMER,
    featureFlags: {},
  };
}

/**
 * Load the IDIQ config from Convex platformSettings, falling back to env
 * defaults if the DB is unreachable. Caller may pass a Clerk token (admin
 * pages can read settings even though the table doesn't gate by user); if
 * unauth'd, the helper still works because `listByPrefix` doesn't enforce a
 * role. We keep `token` optional so RSC pages don't have to thread auth.
 */
export async function loadIdiqConfig(token?: string | null): Promise<IdiqConfig> {
  const defaults = envDefaults();
  try {
    const rows = await fetchQuery(
      api.platformSettings.listByPrefix,
      { prefix: "idiq." },
      { token: token ?? undefined },
    );
    const byKey = new Map<string, unknown>(
      (rows ?? []).map((r: { key: string; valueJson: unknown }) => [r.key, r.valueJson]),
    );

    const str = (k: string, fallback: string): string => {
      const v = byKey.get(k);
      return typeof v === "string" && v.trim().length ? v : fallback;
    };
    const optStr = (k: string, fallback: string | null): string | null => {
      const v = byKey.get(k);
      if (typeof v === "string") return v.trim().length ? v : null;
      return fallback;
    };
    const rec = (
      k: string,
      fallback: Record<string, boolean>,
    ): Record<string, boolean> => {
      const v = byKey.get(k);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return v as Record<string, boolean>;
      }
      return fallback;
    };

    return {
      affiliateUrl: str(IDIQ_SETTING_KEYS.affiliateUrl, defaults.affiliateUrl),
      stageUrl: optStr(IDIQ_SETTING_KEYS.stageUrl, defaults.stageUrl),
      displayName: str(IDIQ_SETTING_KEYS.displayName, defaults.displayName),
      instructions: str(IDIQ_SETTING_KEYS.instructions, defaults.instructions),
      disclaimer: str(IDIQ_SETTING_KEYS.disclaimer, defaults.disclaimer),
      featureFlags: rec(IDIQ_SETTING_KEYS.featureFlags, defaults.featureFlags),
    };
  } catch {
    // Convex unreachable — fall back to env defaults rather than breaking
    // the page.
    return defaults;
  }
}

/**
 * Build a personalized IDIQ enrollment URL for a given user. Attribution
 * parameters are added only when the admin-supplied affiliate URL doesn't
 * already carry them, so we don't overwrite campaign/subId the affiliate
 * link already encodes.
 */
export function buildIdiqEnrollUrl(opts: {
  baseUrl: string;
  userId?: string;
  campaign?: string;
  source?: string;
}): string {
  let url: URL;
  try {
    url = new URL(opts.baseUrl);
  } catch {
    return opts.baseUrl;
  }
  if (opts.userId && !url.searchParams.has("subId")) {
    url.searchParams.set("subId", opts.userId);
  }
  if (opts.campaign && !url.searchParams.has("utm_campaign")) {
    url.searchParams.set("utm_campaign", opts.campaign);
  }
  if (opts.source && !url.searchParams.has("utm_source")) {
    url.searchParams.set("utm_source", opts.source);
  }
  return url.toString();
}
