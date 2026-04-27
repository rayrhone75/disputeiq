// MyScoreIQ (MSIQ) integration module — canonical customer-facing provider.
//
// Going forward, every new DisputeIQ customer is guided into their 3-bureau
// report through MyScoreIQ. IdentityIQ + MyFreeScoreNow rows remain readable
// in admin/support views (legacy enum values on `creditReports.source` and
// `creditReportImports.provider`) but are no longer advertised to new users.
//
// The MyScoreIQ JSON report is exposed at the same shape as the IdentityIQ
// payload — both products share an underlying credit-data platform — so the
// `lib/credit-import/providers/identityiq.ts` adapter (also registered as
// `myScoreIqAdapter`) handles both.
//
// Configuration values (affiliate URL, JSON report URL, display copy) live in
// the `platformSettings` Convex table so admins can rotate them without a
// deploy. Precedence is defaults ← env ← DB. Legacy IDIQ_* keys/env vars are
// honored as a fallback so the rollout is safe on environments that haven't
// switched their secrets yet.
//
// Audit/event names (`IDIQ_CLICK`) and Convex provider enums (`IDENTITYIQ`)
// are intentionally NOT renamed — they are stable internal identifiers and
// renaming them would require a full data migration. Customer-facing copy
// reads from `MSIQ.productName` instead, so the UI labels are decoupled
// from the legacy storage names.

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const MSIQ = {
  productName: "MyScoreIQ",
  shortName: "MyScoreIQ",
  parentBrand: "DisputeIQ",
  ctaPrimary: "Activate MyScoreIQ",
  ctaSecondary: "Get your credit report",
  supportedNote:
    "MyScoreIQ is the supported credit report provider for DisputeIQ. It delivers the tri-merge JSON file DisputeIQ analyzes for disputes.",
} as const;

// Convex platformSettings keys — `msiq.*` is canonical, with `idiq.*`
// honored as legacy fallback so we don't lose admin-managed values that
// were saved before the rename.
export const MSIQ_SETTING_KEYS = {
  affiliateUrl: "msiq.affiliateUrl",
  jsonReportUrl: "msiq.jsonReportUrl",
  stageUrl: "msiq.stageUrl",
  displayName: "msiq.displayName",
  instructions: "msiq.instructions",
  disclaimer: "msiq.disclaimer",
  featureFlags: "msiq.featureFlags",
} as const;

export type MsiqConfig = {
  affiliateUrl: string;
  jsonReportUrl: string;
  stageUrl: string | null;
  displayName: string;
  instructions: string;
  disclaimer: string;
  featureFlags: Record<string, boolean>;
};

const DEFAULT_AFFILIATE_URL =
  "https://gcpstage.myscoreiq.com/get-fico-preferred.aspx?offercode=432500C3";
const DEFAULT_JSON_REPORT_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

const DEFAULT_INSTRUCTIONS = [
  "Click Activate MyScoreIQ to open MyScoreIQ's enrollment page in a new tab.",
  "Complete the MyScoreIQ signup and pull your 3-bureau report.",
  "Return to DisputeIQ — your workspace will be ready to import your report.",
].join("\n");

const DEFAULT_DISCLAIMER =
  "MyScoreIQ is an independent third-party credit-monitoring service. DisputeIQ is a workflow tool — we do not guarantee outcomes or score changes. You can dispute inaccuracies yourself, for free, directly with the bureaus.";

function envDefaults(): MsiqConfig {
  return {
    affiliateUrl:
      process.env.MYSCOREIQ_AFFILIATE_URL ??
      process.env.NEXT_PUBLIC_MYSCOREIQ_AFFILIATE_URL ??
      DEFAULT_AFFILIATE_URL,
    jsonReportUrl:
      process.env.MYSCOREIQ_JSON_REPORT_URL ??
      process.env.NEXT_PUBLIC_MYSCOREIQ_JSON_REPORT_URL ??
      DEFAULT_JSON_REPORT_URL,
    stageUrl: process.env.MYSCOREIQ_STAGE_URL ?? null,
    displayName: process.env.MYSCOREIQ_DISPLAY_NAME ?? MSIQ.productName,
    instructions: DEFAULT_INSTRUCTIONS,
    disclaimer: DEFAULT_DISCLAIMER,
    featureFlags: {},
  };
}

/**
 * Load the MyScoreIQ config from Convex platformSettings, falling back to env
 * defaults if the DB is unreachable. Only `msiq.*` keys are honored —
 * stale `idiq.*` rows from before the MyScoreIQ refactor are intentionally
 * ignored so legacy IdentityIQ copy can never resurface in the UI.
 */
export async function loadMsiqConfig(token?: string | null): Promise<MsiqConfig> {
  const defaults = envDefaults();
  try {
    const rows = await fetchQuery(
      api.platformSettings.listByPrefix,
      { prefix: "msiq." },
      { token: token ?? undefined },
    );
    const byKey = new Map<string, unknown>(
      ((rows ?? []) as Array<{ key: string; valueJson: unknown }>).map(
        (r) => [r.key, r.valueJson] as [string, unknown],
      ),
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
      affiliateUrl: str(MSIQ_SETTING_KEYS.affiliateUrl, defaults.affiliateUrl),
      jsonReportUrl: str(
        MSIQ_SETTING_KEYS.jsonReportUrl,
        defaults.jsonReportUrl,
      ),
      stageUrl: optStr(MSIQ_SETTING_KEYS.stageUrl, defaults.stageUrl),
      displayName: str(MSIQ_SETTING_KEYS.displayName, defaults.displayName),
      instructions: str(MSIQ_SETTING_KEYS.instructions, defaults.instructions),
      disclaimer: str(MSIQ_SETTING_KEYS.disclaimer, defaults.disclaimer),
      featureFlags: rec(MSIQ_SETTING_KEYS.featureFlags, defaults.featureFlags),
    };
  } catch {
    return defaults;
  }
}

/**
 * Build a personalized MyScoreIQ enrollment URL for a given user. Attribution
 * parameters are added only when the admin-supplied affiliate URL doesn't
 * already carry them, so we don't overwrite campaign/subId the affiliate
 * link already encodes.
 */
export function buildMsiqEnrollUrl(opts: {
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
