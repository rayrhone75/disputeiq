import { Button, Chip, KpiCard, PageHeader, SectionHeader, Surface } from "@/components/ui/primitives";

export default function AdminHome() {
  const kpis = [
    { label: "Active users", value: "1,284", delta: "+38 wk", intent: "up" as const },
    { label: "Open disputes", value: "342", hint: "Across all tenants" },
    { label: "Letters in flight", value: "57", hint: "Certified mail" },
    { label: "MRR", value: "$18.4k", delta: "+6.2%", intent: "up" as const },
  ];

  const queue = [
    { id: "DC-9821", user: "ava@example.com", state: "Awaiting payment", tone: "warning" as const, when: "2m" },
    { id: "DC-9817", user: "marcus@example.com", state: "Mailed", tone: "accent" as const, when: "14m" },
    { id: "DC-9803", user: "lina@example.com", state: "Delivered", tone: "success" as const, when: "1h" },
    { id: "DC-9798", user: "samir@example.com", state: "Failed dispatch", tone: "danger" as const, when: "2h" },
  ];

  const flags = [
    "Repeated failed payments — review",
    "Identity document missing on 605B case",
    "New affiliate signup needs verification",
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Command Center"
        title="Operations overview"
        description="Mirror users safely, monitor live cases, and audit every action. All admin actions are logged immutably."
        actions={
          <>
            <Button variant="secondary">View as user</Button>
            <Button>Toggle Grace</Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Surface className="lg:col-span-2 p-8">
          <SectionHeader title="Live case queue" action={<Chip tone="accent">Realtime</Chip>} />
          <div className="overflow-hidden rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                <tr>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id} className="border-t border-ink-100">
                    <td className="px-4 py-4 font-mono text-xs text-ink-700">{q.id}</td>
                    <td className="px-4 py-4 text-ink-500">{q.user}</td>
                    <td className="px-4 py-4">
                      <Chip tone={q.tone}>{q.state}</Chip>
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-ink-400">{q.when} ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        <Surface className="p-8">
          <SectionHeader title="Risk flags" />
          <ul className="space-y-3">
            {flags.map((f) => (
              <li key={f} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-warning-500" />
                <p className="text-sm text-ink-700">{f}</p>
              </li>
            ))}
          </ul>
        </Surface>
      </section>

      <Surface className="p-8">
        <SectionHeader title="Audit log" action={<Button size="sm" variant="secondary" href="/admin/audit-logs">Open explorer</Button>} />
        <ol className="divide-y divide-ink-100">
          {[
            ["LETTER_DISPATCHED", "DisputeCase:DC-9817", "12:04:11"],
            ["PAYMENT_SUCCEEDED", "PaymentIntent:PI-4412", "12:03:58"],
            ["DISPUTE_CREATED", "DisputeCase:DC-9817", "11:58:02"],
            ["USER_SIGNUP", "User:ava@example.com", "11:32:44"],
          ].map(([action, entity, time]) => (
            <li key={action + entity} className="flex items-center justify-between py-3 text-sm">
              <span className="font-mono text-xs text-ink-500">{time}</span>
              <span className="font-medium text-ink-900">{action}</span>
              <span className="font-mono text-xs text-ink-500">{entity}</span>
            </li>
          ))}
        </ol>
      </Surface>
    </div>
  );
}
