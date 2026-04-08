import { Button, Chip, KpiCard, PageHeader, SectionHeader, Surface, TrustBanner } from "@/components/ui/primitives";

export default function DashboardHome() {
  // Polished mocked snapshot — wiring stays compatible with real data.
  const kpis = [
    { label: "Active disputes", value: "4", delta: "+2 wk", intent: "up" as const, hint: "2 ready to mail this week" },
    { label: "Items flagged", value: "11", delta: "3 high", intent: "down" as const, hint: "Across Experian, Equifax, TransUnion" },
    { label: "Letters in flight", value: "2", hint: "Certified mail, awaiting delivery scan" },
    { label: "Score trend", value: "+34", delta: "90d", intent: "up" as const, hint: "Estimated, not guaranteed" },
  ];

  const activity = [
    { time: "Just now", label: "Cross-bureau audit completed", tone: "accent" as const },
    { time: "12m", label: "TransUnion balance mismatch flagged", tone: "warning" as const },
    { time: "1h", label: "Certified letter delivered to Equifax", tone: "success" as const },
    { time: "3h", label: "New report uploaded for analysis", tone: "neutral" as const },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Welcome back"
        description="Your credit operations at a glance. Every action below is logged, reversible, and requires your confirmation."
        actions={
          <>
            <Button variant="secondary" href="/dashboard/reports">Upload report</Button>
            <Button href="/dashboard/disputes">New dispute</Button>
          </>
        }
      />

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Next best action */}
        <Surface className="lg:col-span-2 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-500">Next best action</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900">
                Confirm the cross-bureau balance mismatch on a Capital One tradeline.
              </h2>
              <p className="mt-3 max-w-xl text-sm text-ink-500">
                Two bureaus report different balances on the same account. We've prepared a factual dispute draft for
                your review. Nothing is sent until you confirm.
              </p>
            </div>
            <Chip tone="warning">High signal</Chip>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Equifax", "$1,284"],
              ["Experian", "$1,402"],
              ["TransUnion", "$1,402"],
            ].map(([b, v]) => (
              <div key={b} className="rounded-xl border border-ink-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{b}</p>
                <p className="mt-1 font-display text-xl font-semibold text-ink-900">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3">
            <Button href="/dashboard/disputes">Review and prepare</Button>
            <Button variant="ghost">Snooze 24h</Button>
          </div>
        </Surface>

        {/* Activity */}
        <Surface className="p-8">
          <SectionHeader title="Recent activity" />
          <ol className="space-y-4">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-accent-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-900">{a.label}</p>
                  <p className="text-xs text-ink-400">{a.time} ago</p>
                </div>
                <Chip tone={a.tone}>log</Chip>
              </li>
            ))}
          </ol>
        </Surface>
      </section>

      {/* Timeline rail */}
      <Surface className="p-8">
        <SectionHeader title="Dispute momentum" action={<Chip tone="accent">Last 30 days</Chip>} />
        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-ink-100" />
          <div className="relative grid grid-cols-5 gap-4">
            {[
              ["Drafted", "4"],
              ["Confirmed", "3"],
              ["Paid", "3"],
              ["Mailed", "2"],
              ["Delivered", "1"],
            ].map(([label, count], i) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-ink-200 ${
                    i <= 2 ? "shadow-card" : ""
                  }`}
                >
                  <span className="font-display text-sm font-semibold text-ink-900">{count}</span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Surface>

      <TrustBanner>
        You may dispute inaccuracies on your credit report yourself, for free, directly with the bureaus. DisputeIQ is a
        software and workflow tool — we never guarantee removals or score changes, and we never submit anything without
        your explicit confirmation.
      </TrustBanner>
    </div>
  );
}
