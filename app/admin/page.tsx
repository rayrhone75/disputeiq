import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";

export default async function AdminHome() {
  await requireRole(["OWNER", "ADMIN", "SUPPORT"]);

  const [userCount, disputeCount, mailJobCount, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.disputeCase.count(),
    prisma.mailJob.count({ where: { status: { in: ["QUEUED", "SUBMITTED", "MAILED"] } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Command center"
        description="Real-time platform metrics from the database."
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total users", value: userCount },
          { label: "Total disputes", value: disputeCount },
          { label: "Mail in flight", value: mailJobCount },
          { label: "Audit entries", value: recentLogs.length > 0 ? "Live" : "0" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-ink-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">{c.value}</p>
          </div>
        ))}
      </section>

      <Surface className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">Recent audit log</h2>
        {recentLogs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600">No audit entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100 text-sm">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold text-ink-900">{l.action}</div>
                  <div className="text-xs text-ink-500">
                    {l.entityType} · {l.entityId.slice(0, 12)}
                  </div>
                </div>
                <div className="text-xs text-ink-500">
                  {l.createdAt.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
