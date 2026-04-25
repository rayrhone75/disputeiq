"use client";

import Link from "next/link";

export type Verdict = {
  classification:
    | "verified"
    | "updated"
    | "deleted"
    | "stall"
    | "no_investigation"
    | "unclear";
  recommendation: "accept_as_resolved" | "re_dispute" | "escalate_cfpb";
  reasoning: string;
};

const tone: Record<Verdict["classification"], { bg: string; fg: string; label: string; desc: string }> = {
  deleted: {
    bg: "bg-emerald-50 ring-emerald-200",
    fg: "text-emerald-700",
    label: "Deleted",
    desc: "The bureau removed this tradeline. Marking the case closed will update your metrics.",
  },
  updated: {
    bg: "bg-amber-50 ring-amber-200",
    fg: "text-amber-700",
    label: "Updated",
    desc: "The bureau changed the record but did not delete. Review the change and decide whether it resolves your dispute.",
  },
  verified: {
    bg: "bg-rose-50 ring-rose-200",
    fg: "text-rose-700",
    label: "Verified",
    desc: "The bureau claims the record is accurate. If you disagree, escalate with a Method of Verification demand.",
  },
  stall: {
    bg: "bg-amber-50 ring-amber-200",
    fg: "text-amber-700",
    label: "Stall tactic",
    desc: "The bureau issued a non-response or demanded more proof than the FCRA requires. Re-dispute or escalate.",
  },
  no_investigation: {
    bg: "bg-rose-50 ring-rose-200",
    fg: "text-rose-700",
    label: "No investigation",
    desc: "The bureau declined to investigate. This is a CFPB-eligible scenario under §1681i.",
  },
  unclear: {
    bg: "bg-surface-muted ring-border-strong",
    fg: "text-fg-muted",
    label: "Unclear",
    desc: "We could not cleanly classify the response. Read it manually and choose the next step.",
  },
};

const recLabel: Record<Verdict["recommendation"], string> = {
  accept_as_resolved: "Accept as resolved",
  re_dispute: "Re-dispute (round 2)",
  escalate_cfpb: "File CFPB complaint",
};

export function ResponseVerdictCard({
  verdict,
  disputeCaseId,
}: {
  verdict: Verdict;
  disputeCaseId: string;
}) {
  const t = tone[verdict.classification];
  return (
    <div className={`mt-3 rounded-xl p-4 ring-1 ${t.bg}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${t.fg}`}>
            AI verdict
          </p>
          <h4 className="mt-1 text-base font-semibold text-fg">{t.label}</h4>
        </div>
        <span className="rounded-full bg-surface/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted ring-1 ring-border-strong">
          Next: {recLabel[verdict.recommendation]}
        </span>
      </div>
      <p className="mt-2 text-sm text-fg-muted">{t.desc}</p>
      {verdict.reasoning && (
        <p className="mt-2 border-l-2 border-border-strong pl-3 text-xs italic text-fg-muted">
          AI reasoning: {verdict.reasoning}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/disputes/${disputeCaseId}`}
          className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas"
        >
          Open dispute →
        </Link>
        <Link
          href="/dashboard/proof-vault"
          className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-fg-muted ring-1 ring-border-strong hover:bg-surface-muted"
        >
          View in Proof Vault
        </Link>
      </div>
    </div>
  );
}
