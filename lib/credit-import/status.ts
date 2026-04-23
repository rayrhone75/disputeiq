// Credit-report lifecycle status for the customer-facing dashboard.
//
// This is a *derivation* over existing sources of truth — it does not
// introduce a new status column. Inputs:
//
//   - latest `CreditReportImport` for the user (import pipeline)
//   - count of legacy `CreditReport` rows (pre-pipeline imports)
//   - latest `IDIQ_CLICK` audit entry (the user clicked "Continue with IDIQ"
//     but hasn't produced a report yet)
//
// Output is a stable, strongly-typed summary that the `CreditReportStatusChip`
// component consumes. Everything here is read-only.

import { prisma } from "@/lib/prisma";

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
// without touching Prisma.
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
 *   1. Latest `CreditReportImport` — if present, its status decides everything.
 *      NORMALIZED → imported, FAILED → failed, PENDING/FETCHED/VALIDATED → in_progress.
 *      ARCHIVED imports are ignored (treated as if they don't exist).
 *   2. Legacy `CreditReport` — any rows mean the user has an imported file.
 *   3. `IDIQ_CLICK` audit — the user has opened IDIQ but not returned yet.
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
    // PENDING / FETCHED / VALIDATED — import started but not finalized.
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

export async function loadCreditReportStatus(
  userId: string,
): Promise<CreditReportStatusSummary> {
  const [latestImport, legacyReportCount, idiqClick] = await Promise.all([
    prisma.creditReportImport.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        normalizedAt: true,
      },
    }),
    prisma.creditReport.count({ where: { userId } }),
    prisma.auditLog.findFirst({
      where: { targetUserId: userId, action: "IDIQ_CLICK" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return deriveCreditReportStatus({ latestImport, legacyReportCount, idiqClick });
}
