// AI report analysis. Deterministic findings first (cross-bureau mismatches,
// duplicates, stale collections), then Claude-haiku as a reasoning layer to
// summarize and prioritize. Never invents tradelines.
import { callClaude } from "./client";
import type { Tradeline } from "@prisma/client";

export interface ReportFinding {
  tradelineIds: string[];
  creditor: string;
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
  suggestedLetterType:
    | "FACTUAL_DISPUTE"
    | "MOV_REQUEST"
    | "DIRECT_FURNISHER"
    | "IDENTITY_THEFT_605B";
}

export interface TriMergeRow {
  groupKey: string;
  creditor: string;
  accountRefMasked: string;
  cells: {
    EQUIFAX?: { tradelineId: string; balanceCents: number | null; statusLabel: string | null };
    EXPERIAN?: { tradelineId: string; balanceCents: number | null; statusLabel: string | null };
    TRANSUNION?: { tradelineId: string; balanceCents: number | null; statusLabel: string | null };
  };
  disputable: {
    code: string;
    reason: string;
    confidence: "low" | "medium" | "high";
    recommendedAction: string;
    missingEvidence: string[];
    severity: "low" | "medium" | "high";
    targetBureaus: Array<"EQUIFAX" | "EXPERIAN" | "TRANSUNION">;
  } | null;
}

export interface AnalyzeResult {
  findings: ReportFinding[];
  triMerge: TriMergeRow[];
  summary: string;
  aiLive: boolean;
}

const BUREAU_NORM: Record<string, "EQUIFAX" | "EXPERIAN" | "TRANSUNION" | null> = {
  EQUIFAX: "EQUIFAX",
  EQ: "EQUIFAX",
  EXPERIAN: "EXPERIAN",
  EX: "EXPERIAN",
  TRANSUNION: "TRANSUNION",
  TU: "TRANSUNION",
};

function buildTriMerge(tls: Tradeline[]): TriMergeRow[] {
  const groups = groupByAccount(tls);
  const rows: TriMergeRow[] = [];
  for (const [groupKey, rowsInGroup] of groups) {
    const cells: TriMergeRow["cells"] = {};
    for (const t of rowsInGroup) {
      const b = BUREAU_NORM[t.bureau.toUpperCase()];
      if (!b) continue;
      cells[b] = { tradelineId: t.id, balanceCents: t.balanceCents, statusLabel: t.statusLabel };
    }

    // Disputability heuristic for this row
    const balances = new Set(
      Object.values(cells)
        .map((c) => c?.balanceCents ?? null)
        .filter((v) => v != null),
    );
    const statuses = new Set(
      Object.values(cells)
        .map((c) => c?.statusLabel ?? null)
        .filter((v) => v != null),
    );

    let disputable: TriMergeRow["disputable"] = null;
    const present = (Object.keys(cells) as Array<"EQUIFAX" | "EXPERIAN" | "TRANSUNION">).filter(
      (k) => cells[k],
    );

    if (balances.size > 1) {
      disputable = {
        code: "Balance mismatch",
        reason: `Bureaus report different balances: ${present
          .map((b) => `${b}=$${((cells[b]!.balanceCents ?? 0) / 100).toFixed(2)}`)
          .join(", ")}`,
        confidence: "high",
        severity: "high",
        recommendedAction:
          "Send a factual dispute under FCRA §611 to each bureau showing the inaccurate balance.",
        missingEvidence: ["Most recent statement from the original creditor"],
        targetBureaus: present,
      };
    } else if (statuses.size > 1) {
      disputable = {
        code: "Status mismatch",
        reason: `Bureaus disagree on account status: ${present
          .map((b) => `${b}=${cells[b]!.statusLabel ?? "—"}`)
          .join(", ")}`,
        confidence: "medium",
        severity: "medium",
        recommendedAction:
          "Send a factual dispute under FCRA §611 demanding a single, accurate status across all three bureaus.",
        missingEvidence: ["Original creditor confirmation of current status"],
        targetBureaus: present,
      };
    } else if (rowsInGroup.some((r) => r.isCollection) && present.length > 1) {
      disputable = {
        code: "Collection reporting",
        reason: "Collection account is reported on multiple bureaus — verify the underlying debt.",
        confidence: "low",
        severity: "low",
        recommendedAction:
          "Consider a Method of Verification request under FCRA §611(a)(6)(B)(iii) before escalating.",
        missingEvidence: ["Debt validation letter from collector"],
        targetBureaus: present,
      };
    }

    rows.push({
      groupKey,
      creditor: rowsInGroup[0].creditorName,
      accountRefMasked: rowsInGroup[0].accountRefMasked,
      cells,
      disputable,
    });
  }
  // Sort: disputable+high first, then medium, then low/none
  const order = { high: 0, medium: 1, low: 2 } as const;
  rows.sort((a, b) => {
    const aS = a.disputable ? order[a.disputable.severity] : 3;
    const bS = b.disputable ? order[b.disputable.severity] : 3;
    return aS - bS;
  });
  return rows;
}

function groupByAccount(tls: Tradeline[]): Map<string, Tradeline[]> {
  const m = new Map<string, Tradeline[]>();
  for (const t of tls) {
    const key = `${t.creditorName.toLowerCase().replace(/\s+/g, "")}::${t.accountRefMasked}`;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(t);
  }
  return m;
}

function detectFindings(tls: Tradeline[]): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const groups = groupByAccount(tls);

  for (const [, rows] of groups) {
    if (rows.length > 1) {
      const balances = new Set(rows.map((r) => r.balanceCents ?? -1));
      if (balances.size > 1) {
        findings.push({
          tradelineIds: rows.map((r) => r.id),
          creditor: rows[0].creditorName,
          code: "Balance mismatch",
          severity: "high",
          detail: `Bureaus report different balances for the same account: ${rows
            .map((r) => `${r.bureau}=${r.balanceCents ?? "—"}`)
            .join(", ")}`,
          suggestedLetterType: "FACTUAL_DISPUTE",
        });
      }
      const statuses = new Set(rows.map((r) => r.statusLabel ?? ""));
      if (statuses.size > 1) {
        findings.push({
          tradelineIds: rows.map((r) => r.id),
          creditor: rows[0].creditorName,
          code: "Status mismatch",
          severity: "medium",
          detail: `Bureaus report different statuses: ${rows
            .map((r) => `${r.bureau}=${r.statusLabel ?? "—"}`)
            .join(", ")}`,
          suggestedLetterType: "FACTUAL_DISPUTE",
        });
      }
    }
  }

  // Duplicate collections inside one bureau
  const byBureauCreditor = new Map<string, Tradeline[]>();
  for (const t of tls.filter((x) => x.isCollection)) {
    const k = `${t.bureau}::${t.creditorName.toLowerCase()}`;
    if (!byBureauCreditor.has(k)) byBureauCreditor.set(k, []);
    byBureauCreditor.get(k)!.push(t);
  }
  for (const [, rows] of byBureauCreditor) {
    if (rows.length > 1) {
      findings.push({
        tradelineIds: rows.map((r) => r.id),
        creditor: rows[0].creditorName,
        code: "Duplicate collection",
        severity: "high",
        detail: `${rows.length} collection entries on ${rows[0].bureau} for the same creditor.`,
        suggestedLetterType: "MOV_REQUEST",
      });
    }
  }

  return findings;
}

export async function analyzeReport(tradelines: Tradeline[]): Promise<AnalyzeResult> {
  const findings = detectFindings(tradelines);
  const triMerge = buildTriMerge(tradelines);

  if (findings.length === 0) {
    return {
      findings,
      triMerge,
      summary: "No automated dispute opportunities detected from the parsed tradelines.",
      aiLive: false,
    };
  }

  const ground = findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity.toUpperCase()}] ${f.creditor} — ${f.code}: ${f.detail}`,
    )
    .join("\n");

  const ai = await callClaude({
    model: "haiku",
    system:
      "You are a credit-report analyst. You will be given a list of FACTUAL findings already detected from a consumer's credit report. Your job is ONLY to write a 2-3 sentence plain-English summary for the consumer. Do not invent new findings, accounts, or balances. Do not give legal advice.",
    user: `Findings:\n${ground}\n\nWrite a short summary for the consumer.`,
    maxTokens: 400,
  });

  return { findings, triMerge, summary: ai.text.trim(), aiLive: ai.live };
}
