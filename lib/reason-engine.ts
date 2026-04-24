// Rules-first reason engine. Detects factual mismatches across bureau snapshots.
// Originally typed against the Prisma `Tradeline` row; now accepts a structural
// shape so it can run on either legacy `tradelines` or the new `creditTradelines`
// pipeline rows. Caller adapts the input.

export type AuditTradeline = {
  id: string;
  creditorName: string;
  accountRefMasked: string;
  balanceCents?: number | null;
  statusLabel?: string | null;
};

export type AuditFinding = {
  tradelineId: string;
  code: string;
  severity: "low" | "medium" | "high";
  summary: string;
};

export function auditTradelines(tradelines: AuditTradeline[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  // Group by masked account ref to compare across bureaus
  const groups = new Map<string, AuditTradeline[]>();
  for (const t of tradelines) {
    const k = `${t.creditorName}::${t.accountRefMasked}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const balances = new Set(group.map((t) => t.balanceCents ?? -1));
    if (balances.size > 1) {
      for (const t of group) {
        findings.push({
          tradelineId: t.id,
          code: "BALANCE_MISMATCH",
          severity: "high",
          summary: "Reported balance differs across bureaus.",
        });
      }
    }
    const statuses = new Set(group.map((t) => t.statusLabel ?? ""));
    if (statuses.size > 1) {
      for (const t of group) {
        findings.push({
          tradelineId: t.id,
          code: "STATUS_MISMATCH",
          severity: "medium",
          summary: "Account status differs across bureaus.",
        });
      }
    }
  }
  return findings;
}

export function suggestFactualBasis(findings: AuditFinding[]): string {
  if (findings.length === 0) return "No factual inconsistencies detected by automated audit.";
  const codes = Array.from(new Set(findings.map((f) => f.code)));
  return `Automated audit identified: ${codes.join(", ")}. User to review and confirm before any action.`;
}
