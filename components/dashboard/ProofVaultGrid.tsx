import Link from "next/link";

export type VaultEntry = {
  id: string;
  disputeCaseId: string;
  kind: string;
  createdAt: string;
  creditor: string;
  bureau: string;
  status: string;
  classification?: string;
  recommendation?: string;
  reasoning?: string;
};

const classBadge: Record<string, string> = {
  verified: "bg-rose-100 text-rose-700 ring-rose-200",
  updated: "bg-amber-100 text-amber-700 ring-amber-200",
  deleted: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  stall: "bg-amber-100 text-amber-700 ring-amber-200",
  no_investigation: "bg-rose-100 text-rose-700 ring-rose-200",
  unclear: "bg-ink-100 text-ink-700 ring-ink-200",
};

const recLabel: Record<string, string> = {
  accept_as_resolved: "Accept as resolved",
  re_dispute: "Re-dispute",
  escalate_cfpb: "Escalate to CFPB",
};

const kindLabel: Record<string, string> = {
  BUREAU_RESPONSE: "Bureau response",
  DISPUTE_LETTER: "Dispute letter",
  PROOF: "Proof document",
};

export function ProofVaultGrid({ entries }: { entries: VaultEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-ink-900">No proof uploaded yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
          When a bureau responds to a dispute, upload the letter from the dispute detail page.
          Our AI parses the response and files it here with a verdict and next-step recommendation.
        </p>
        <Link
          href="/dashboard/disputes"
          className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
        >
          Go to disputes
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((e) => {
        const c = e.classification ?? "unclear";
        return (
          <article
            key={e.id}
            className="flex flex-col justify-between rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
                  {kindLabel[e.kind] ?? e.kind}
                </p>
                <span className="text-[10px] text-ink-400">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-ink-900">{e.creditor}</h3>
              <p className="text-xs text-ink-500">
                {e.bureau} · case {e.disputeCaseId.slice(0, 8)}
              </p>

              {e.classification && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${classBadge[c]}`}
                  >
                    {c.replace(/_/g, " ")}
                  </span>
                  {e.recommendation && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      → {recLabel[e.recommendation] ?? e.recommendation}
                    </span>
                  )}
                </div>
              )}

              {e.reasoning && (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-600">
                  {e.reasoning}
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Link
                href={`/dashboard/disputes/${e.disputeCaseId}`}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Open dispute →
              </Link>
              <a
                href={`/api/proof-vault/download?id=${e.id}`}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50"
              >
                Download PDF
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
