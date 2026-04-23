// Rule-based dispute candidate generator.
//
// Runs against a fully-normalized report and produces bureau-specific
// dispute candidates. Candidates are intentionally *not* DisputeCase rows —
// promoting a candidate is a deliberate downstream action.
//
// Rules are explicit and conservative. Every candidate carries:
//   - a structured `evidenceJson` block with the facts that triggered it
//   - a `reason` + `reasonCodes` machine-readable enumeration
//   - a `legalBasis` list (FCRA sections etc.) for letter generation
//
// When in doubt: emit fewer, higher-confidence candidates. False positives
// erode user trust; false negatives can always be caught by a second round.

import type { DisputeCandidateReason, DisputeCandidateStage } from "@prisma/client";
import type {
  BureauKey,
  NormalizedReport,
  NormalizedTradeline,
} from "./types";
import { tradelineFingerprint } from "./util";

export type DisputeCandidate = {
  tradelineFingerprint?: string;
  bureau: BureauKey;
  stage: DisputeCandidateStage;
  reason: DisputeCandidateReason;
  reasonCodes: string[];
  severity: "low" | "medium" | "high";
  summary: string;
  evidenceJson: Record<string, unknown>;
  legalBasis: string[];
  confidence: "low" | "medium" | "high";
};

const FCRA_611 = "FCRA §611 (15 U.S.C. §1681i) — reinvestigation duty";
const FCRA_623 = "FCRA §623 (15 U.S.C. §1681s-2) — furnisher duty";
const FCRA_605 = "FCRA §605 (15 U.S.C. §1681c) — obsolete information removal";
const FCRA_605A = "FCRA §605A — identity-theft block";
const NO_SURPRISES = "No Surprises Act / CFPB medical debt guidance";

function groupByFingerprint(report: NormalizedReport): Map<string, NormalizedTradeline[]> {
  const groups = new Map<string, NormalizedTradeline[]>();
  for (const t of report.tradelines) {
    const fp = tradelineFingerprint({
      bureau: "ANY", // cross-bureau group
      creditorName: t.creditorName,
      accountRefMasked: t.accountRefMasked,
    });
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp)!.push(t);
  }
  return groups;
}

function ageYears(iso?: string): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return undefined;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export function runDisputeEngine(report: NormalizedReport): DisputeCandidate[] {
  const out: DisputeCandidate[] = [];

  // ── Cross-bureau mismatches ───────────────────────────────────────────
  const groups = groupByFingerprint(report);
  for (const [, rows] of groups) {
    if (rows.length < 2) continue;
    const balances = new Set(rows.map((r) => r.balanceCents ?? -1));
    const statuses = new Set(rows.map((r) => (r.statusLabel ?? "").toLowerCase().trim()));
    const openDates = new Set(rows.map((r) => r.openedAt ?? ""));
    if (balances.size > 1) {
      for (const r of rows) {
        out.push({
          tradelineFingerprint: tradelineFingerprint({
            bureau: r.bureau,
            creditorName: r.creditorName,
            accountRefMasked: r.accountRefMasked,
          }),
          bureau: r.bureau,
          stage: "ROUND_1",
          reason: "BALANCE_MISMATCH",
          reasonCodes: ["CROSS_BUREAU_BALANCE"],
          severity: "high",
          summary: `Balances differ across bureaus for ${r.creditorName} (${r.accountRefMasked}).`,
          evidenceJson: {
            balancesByBureau: rows.map((x) => ({
              bureau: x.bureau,
              balanceCents: x.balanceCents ?? null,
            })),
          },
          legalBasis: [FCRA_611, FCRA_623],
          confidence: "high",
        });
      }
    }
    if (statuses.size > 1) {
      for (const r of rows) {
        out.push({
          tradelineFingerprint: tradelineFingerprint({
            bureau: r.bureau,
            creditorName: r.creditorName,
            accountRefMasked: r.accountRefMasked,
          }),
          bureau: r.bureau,
          stage: "ROUND_1",
          reason: "STATUS_MISMATCH",
          reasonCodes: ["CROSS_BUREAU_STATUS"],
          severity: "high",
          summary: `Account status differs across bureaus for ${r.creditorName} (${r.accountRefMasked}).`,
          evidenceJson: {
            statusesByBureau: rows.map((x) => ({
              bureau: x.bureau,
              status: x.statusLabel ?? null,
            })),
          },
          legalBasis: [FCRA_611, FCRA_623],
          confidence: "high",
        });
      }
    }
    if (openDates.size > 1) {
      for (const r of rows) {
        out.push({
          tradelineFingerprint: tradelineFingerprint({
            bureau: r.bureau,
            creditorName: r.creditorName,
            accountRefMasked: r.accountRefMasked,
          }),
          bureau: r.bureau,
          stage: "ROUND_1",
          reason: "INACCURATE",
          reasonCodes: ["CROSS_BUREAU_OPEN_DATE"],
          severity: "medium",
          summary: `Date-opened differs across bureaus for ${r.creditorName} (${r.accountRefMasked}).`,
          evidenceJson: {
            openedByBureau: rows.map((x) => ({
              bureau: x.bureau,
              openedAt: x.openedAt ?? null,
            })),
          },
          legalBasis: [FCRA_611],
          confidence: "medium",
        });
      }
    }
  }

  // ── Per-tradeline rules ───────────────────────────────────────────────
  for (const t of report.tradelines) {
    const fp = tradelineFingerprint({
      bureau: t.bureau,
      creditorName: t.creditorName,
      accountRefMasked: t.accountRefMasked,
    });

    if (t.isFraudClaimed) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "IDENTITY_THEFT",
        reasonCodes: ["USER_ASSERTED_FRAUD"],
        severity: "high",
        summary: `${t.creditorName} (${t.accountRefMasked}) is marked as identity theft.`,
        evidenceJson: { status: t.statusLabel, remarks: t.remarks ?? [] },
        legalBasis: [FCRA_605A, FCRA_611],
        confidence: "high",
      });
    }

    if (t.isCollection) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "UNVERIFIABLE",
        reasonCodes: ["COLLECTION_ACCOUNT"],
        severity: "high",
        summary: `Collection account with ${t.creditorName} — request full validation and furnisher verification.`,
        evidenceJson: {
          balanceCents: t.balanceCents,
          lastReportedAt: t.lastReportedAt,
          statusLabel: t.statusLabel,
        },
        legalBasis: [FCRA_611, FCRA_623],
        confidence: "high",
      });
    }

    if (t.isChargeOff) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "INACCURATE",
        reasonCodes: ["CHARGE_OFF_STATUS"],
        severity: "high",
        summary: `${t.creditorName} reports a charge-off — verify balance, date of first delinquency, and payment history.`,
        evidenceJson: {
          balanceCents: t.balanceCents,
          pastDueCents: t.pastDueCents,
          lastActivityAt: t.lastActivityAt,
        },
        legalBasis: [FCRA_611, FCRA_623],
        confidence: "high",
      });
    }

    if (t.isMedical && (t.balanceCents ?? 0) > 0 && (t.balanceCents ?? 0) < 50_000) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "MEDICAL_UNDER_LIMIT",
        reasonCodes: ["MEDICAL_UNDER_500"],
        severity: "high",
        summary: `Medical collection under $500 for ${t.creditorName} — should not appear on consumer reports per 2023 CFPB guidance.`,
        evidenceJson: { balanceCents: t.balanceCents, creditor: t.creditorName },
        legalBasis: [FCRA_611, NO_SURPRISES],
        confidence: "high",
      });
    }

    // Obsolete by age — 7+ years since first delinquency for most negatives,
    // 10+ years for bankruptcies (handled under public records below).
    const ageSinceActivity = ageYears(t.lastActivityAt ?? t.lastReportedAt ?? t.openedAt);
    if (t.isDerogatory && typeof ageSinceActivity === "number" && ageSinceActivity >= 7) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "OBSOLETE_BY_AGE",
        reasonCodes: ["FCRA_7_YEAR"],
        severity: "high",
        summary: `${t.creditorName} negative item exceeds 7-year reporting window (${ageSinceActivity.toFixed(1)} years).`,
        evidenceJson: {
          ageYears: Number(ageSinceActivity.toFixed(2)),
          lastActivityAt: t.lastActivityAt,
        },
        legalBasis: [FCRA_605, FCRA_611],
        confidence: "high",
      });
    }

    if (
      typeof t.creditLimitCents === "number" &&
      typeof t.balanceCents === "number" &&
      t.balanceCents > t.creditLimitCents * 1.05
    ) {
      out.push({
        tradelineFingerprint: fp,
        bureau: t.bureau,
        stage: "ROUND_1",
        reason: "INACCURATE",
        reasonCodes: ["BALANCE_EXCEEDS_LIMIT"],
        severity: "medium",
        summary: `Balance exceeds credit limit for ${t.creditorName} — verify utilization data.`,
        evidenceJson: { balanceCents: t.balanceCents, creditLimitCents: t.creditLimitCents },
        legalBasis: [FCRA_611, FCRA_623],
        confidence: "medium",
      });
    }
  }

  // ── Duplicate tradelines on same bureau ───────────────────────────────
  const byBureauCreditor = new Map<string, NormalizedTradeline[]>();
  for (const t of report.tradelines) {
    const key = `${t.bureau}::${t.creditorName.toLowerCase().replace(/\s+/g, "")}::${t.accountRefMasked}`;
    if (!byBureauCreditor.has(key)) byBureauCreditor.set(key, []);
    byBureauCreditor.get(key)!.push(t);
  }
  for (const [, rows] of byBureauCreditor) {
    if (rows.length > 1) {
      const first = rows[0];
      out.push({
        tradelineFingerprint: tradelineFingerprint({
          bureau: first.bureau,
          creditorName: first.creditorName,
          accountRefMasked: first.accountRefMasked,
        }),
        bureau: first.bureau,
        stage: "ROUND_1",
        reason: "DUPLICATE",
        reasonCodes: ["SAME_BUREAU_DUPLICATE"],
        severity: "high",
        summary: `${first.creditorName} appears ${rows.length} times on ${first.bureau}.`,
        evidenceJson: { duplicateCount: rows.length },
        legalBasis: [FCRA_611],
        confidence: "high",
      });
    }
  }

  // ── Collection-specific rules ─────────────────────────────────────────
  for (const c of report.collections) {
    const ageSince = ageYears(c.firstDelinquencyAt);
    if (typeof ageSince === "number" && ageSince >= 7) {
      out.push({
        bureau: c.bureau,
        stage: "ROUND_1",
        reason: "OBSOLETE_BY_AGE",
        reasonCodes: ["FCRA_7_YEAR_COLLECTION"],
        severity: "high",
        summary: `Collection by ${c.collectorName} exceeds 7-year window (${ageSince.toFixed(1)} years since first delinquency).`,
        evidenceJson: {
          firstDelinquencyAt: c.firstDelinquencyAt,
          ageYears: Number(ageSince.toFixed(2)),
        },
        legalBasis: [FCRA_605, FCRA_611],
        confidence: "high",
      });
    }
    if (c.isMedical && (c.balanceCents ?? 0) > 0 && (c.balanceCents ?? 0) < 50_000) {
      out.push({
        bureau: c.bureau,
        stage: "ROUND_1",
        reason: "MEDICAL_UNDER_LIMIT",
        reasonCodes: ["MEDICAL_COLLECTION_UNDER_500"],
        severity: "high",
        summary: `Medical collection under $500 by ${c.collectorName}.`,
        evidenceJson: { balanceCents: c.balanceCents },
        legalBasis: [FCRA_611, NO_SURPRISES],
        confidence: "high",
      });
    }
  }

  // ── Public records ────────────────────────────────────────────────────
  for (const pr of report.publicRecords) {
    const ageSince = ageYears(pr.filedAt);
    const threshold = /bankrupt/i.test(pr.recordType) ? 10 : 7;
    if (typeof ageSince === "number" && ageSince >= threshold) {
      out.push({
        bureau: pr.bureau,
        stage: "ROUND_1",
        reason: "OBSOLETE_BY_AGE",
        reasonCodes: [`FCRA_${threshold}_YEAR_PUBREC`],
        severity: "high",
        summary: `${pr.recordType} on ${pr.bureau} exceeds ${threshold}-year window (${ageSince.toFixed(1)} years).`,
        evidenceJson: { filedAt: pr.filedAt, ageYears: Number(ageSince.toFixed(2)) },
        legalBasis: [FCRA_605, FCRA_611],
        confidence: "high",
      });
    }
  }

  // ── Inquiries — obsolete after 2 years ────────────────────────────────
  for (const q of report.inquiries) {
    if (q.isHard === false) continue;
    const ageSince = ageYears(q.inquiryDate);
    if (typeof ageSince === "number" && ageSince >= 2) {
      out.push({
        bureau: q.bureau,
        stage: "ROUND_1",
        reason: "OBSOLETE_BY_AGE",
        reasonCodes: ["FCRA_2_YEAR_INQUIRY"],
        severity: "low",
        summary: `Hard inquiry by ${q.inquirerName} is older than 2 years (${ageSince.toFixed(1)} years).`,
        evidenceJson: { inquiryDate: q.inquiryDate, ageYears: Number(ageSince.toFixed(2)) },
        legalBasis: [FCRA_605],
        confidence: "medium",
      });
    }
  }

  return out;
}
