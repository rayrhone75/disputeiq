// Credit-report lifecycle status for the customer-facing dashboard.
//
// This is a *derivation* over existing sources of truth — it does not
// introduce a new status column. Inputs:
//
//   - latest `creditReportImports` for the user (import pipeline)
//   - count of legacy `creditReports` rows (pre-pipeline imports)
//   - latest `IDIQ_CLICK` audit entry (the user clicked "Continue with IDIQ"
//     but hasn't produced a report yet)
//
// Output is a stable, strongly-typed summary that the `CreditReportStatusChip`
// component consumes. Everything here is read-only.

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export type CreditReportStatusKind =
  | "not_started"
  | "in_progress"
  | "imported"
  | "failed";

export type CreditReportStatusSummary = {
  kind: CreditReportStatusKind;
  latestImportId: string | null;
  latestImportStatus: string | null;
  legacyReportCount: number;
  hasClickedIdiq: boolean;
  lastUpdatedAt: Date | null;
};

// Pure inputs used by the derivation, extracted so it can be unit-tested
// without touching the database. Dates are Date objects so existing tests
// keep working — the loader converts millis → Date at the boundary.
export type CreditReportStatusInputs = {
  latestImport: {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    normalizedAt: Date | null;
  } | null;
  legacyReportCount: number;
  idiqClick: { createdAt: Date } | null;
};

/**
 * Derive the customer-facing status from the import pipeline's own state.
 * Decision order:
 *   1. Latest creditReportImports — if present, its status decides everything.
 *      NORMALIZED → imported, FAILED → failed, PENDING/FETCHED/VALIDATED → in_progress.
 *      ARCHIVED imports are ignored (treated as if they don't exist).
 *   2. Legacy creditReports — any rows mean the user has an imported file.
 *   3. IDIQ_CLICK audit — the user has opened IDIQ but not returned yet.
 *   4. Otherwise: not started.
 */
export function deriveCreditReportStatus(
  inputs: CreditReportStatusInputs,
): CreditReportStatusSummary {
  const { latestImport, legacyReportCount, idiqClick } = inputs;

  if (latestImport && latestImport.status !== "ARCHIVED") {
    const lastUpdatedAt =
      latestImport.normalizedAt ?? latestImport.updatedAt ?? latestImport.createdAt;

    if (latestImport.status === "NORMALIZED") {
      return {
        kind: "imported",
        latestImportId: latestImport.id,
        latestImportStatus: latestImport.status,
        legacyReportCount,
        hasClickedIdiq: !!idiqClick,
        lastUpdatedAt,
      };
    }
    if (latestImport.status === "FAILED") {
      return {
        kind: "failed",
        latestImportId: latestImport.id,
        latestImportStatus: latestImport.status,
        legacyReportCount,
        hasClickedIdiq: !!idiqClick,
        lastUpdatedAt,
      };
    }
    return {
      kind: "in_progress",
      latestImportId: latestImport.id,
      latestImportStatus: latestImport.status,
      legacyReportCount,
      hasClickedIdiq: !!idiqClick,
      lastUpdatedAt,
    };
  }

  if (legacyReportCount > 0) {
    return {
      kind: "imported",
      latestImportId: null,
      latestImportStatus: null,
      legacyReportCount,
      hasClickedIdiq: !!idiqClick,
      lastUpdatedAt: null,
    };
  }

  if (idiqClick) {
    return {
      kind: "in_progress",
      latestImportId: null,
      latestImportStatus: null,
      legacyReportCount,
      hasClickedIdiq: true,
      lastUpdatedAt: idiqClick.createdAt,
    };
  }

  return {
    kind: "not_started",
    latestImportId: null,
    latestImportStatus: null,
    legacyReportCount,
    hasClickedIdiq: false,
    lastUpdatedAt: null,
  };
}

/**
 * Load the calling user's status. Caller must pass their Clerk Convex token.
 *
 * Defensive: guards against malformed/missing tokens (e.g. when the Clerk
 * "convex" JWT template hasn't been configured yet) by returning the
 * "not_started" empty state instead of crashing the page.
 */
export async function loadCreditReportStatus(
  token: string | null,
): Promise<CreditReportStatusSummary> {
  // A real Convex JWT is exactly three base64-url segments separated by dots.
  // Anything else (Clerk session id, plain user id, garbage) is rejected by
  // Convex with InvalidAuthHeader. Skip the call entirely in that case.
  const looksLikeJwt =
    typeof token === "string" && token.split(".").length === 3 && token.length > 20;
  const opts = { token: looksLikeJwt ? (token as string) : undefined } as const;

  try {
    const [latest, legacyReportCount, idiqClick] = await Promise.all([
      fetchQuery(api.creditImports.latestForCurrentUser, {}, opts),
      fetchQuery(api.creditReports.countForCurrentUser, {}, opts),
      fetchQuery(api.creditReports.latestIdiqClickForCurrentUser, {}, opts),
    ]);

    const latestImport = latest
      ? {
          id: latest._id as unknown as string,
          status: latest.status,
          createdAt: new Date(latest.createdAt),
          updatedAt: new Date(latest.updatedAt),
          normalizedAt: latest.normalizedAt ? new Date(latest.normalizedAt) : null,
        }
      : null;

    return deriveCreditReportStatus({
      latestImport,
      legacyReportCount: legacyReportCount ?? 0,
      idiqClick: idiqClick ? { createdAt: new Date(idiqClick.createdAt) } : null,
    });
  } catch {
    return deriveCreditReportStatus({
      latestImport: null,
      legacyReportCount: 0,
      idiqClick: null,
    });
  }
}
