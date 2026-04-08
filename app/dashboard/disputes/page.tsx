import { Button, Chip, KpiCard, PageHeader, SectionHeader, Surface } from "@/components/ui/primitives";

// "Purple Heatmap" lite — premium cross-bureau visualizer with severity chips.
type Severity = "low" | "medium" | "high";
const sevTone: Record<Severity, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

const findings: Array<{
  creditor: string;
  account: string;
  code: string;
  severity: Severity;
  detail: string;
  bureaus: { eq?: string; ex?: string; tu?: string };
}> = [
  {
    creditor: "Capital One",
    account: "•••• 4421",
    code: "Balance mismatch",
    severity: "high",
    detail: "Equifax reports a different balance than Experian and TransUnion on the same account.",
    bureaus: { eq: "$1,284", ex: "$1,402", tu: "$1,402" },
  },
  {
    creditor: "Sallie Mae",
    account: "•••• 8839",
    code: "Status mismatch",
    severity: "medium",
    detail: "TransUnion reports the account as Closed while the other bureaus report Open.",
    bureaus: { eq: "Open", ex: "Open", tu: "Closed" },
  },
  {
    creditor: "LVNV Funding",
    account: "•••• 0021",
    code: "Duplicate report",
    severity: "high",
    detail: "Same collection appears twice on Experian under slightly different identifiers.",
    bureaus: { eq: "—", ex: "Duplicate", tu: "Reported" },
  },
];

export default function DisputesPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Heatmap"
        title="Cross-bureau analyzer"
        description="Every flagged item below is a factual inconsistency across bureaus. You decide which to dispute. Nothing leaves your account without confirmation."
        actions={<Button>Open builder</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Items flagged" value="11" delta="3 high" intent="down" />
        <KpiCard label="High severity" value="3" hint="Strongest factual basis" />
        <KpiCard label="Medium" value="5" hint="Worth a second look" />
        <KpiCard label="Low" value="3" hint="Informational only" />
      </section>

      <Surface className="p-8">
        <SectionHeader title="Flagged tradelines" action={<Chip tone="accent">Live snapshot</Chip>} />
        <div className="space-y-4">
          {findings.map((f) => (
            <div
              key={f.creditor + f.account}
              className="group rounded-2xl border border-ink-100 bg-white p-6 transition hover:shadow-cardHover"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-semibold text-ink-900">{f.creditor}</h3>
                    <span className="text-xs text-ink-400">{f.account}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{f.detail}</p>
                </div>
                <Chip tone={sevTone[f.severity]}>{f.code}</Chip>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(["eq", "ex", "tu"] as const).map((b) => {
                  const labels = { eq: "Equifax", ex: "Experian", tu: "TransUnion" };
                  const v = f.bureaus[b];
                  return (
                    <div
                      key={b}
                      className={`rounded-xl border p-4 ${
                        v && v !== "—"
                          ? "border-ink-100 bg-ink-50/40"
                          : "border-dashed border-ink-200 bg-white"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                        {labels[b]}
                      </p>
                      <p className="mt-1 font-display text-lg font-semibold text-ink-900">{v ?? "—"}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-ink-400">User-confirmed factual basis only.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">View evidence</Button>
                  <Button size="sm">Prepare dispute</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
