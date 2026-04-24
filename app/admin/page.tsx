import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";

export default async function AdminHome() {
  await requireRole(["OWNER", "ADMIN", "SUPPORT"]);
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const counts = token
    ? await fetchQuery(api.admin.dashboardCounts, {}, { token }).catch(() => null)
    : null;

  const userCount = counts?.userCount ?? 0;
  const disputeCount = counts?.disputeCount ?? 0;
  const mailJobCount = counts?.mailJobCount ?? 0;
  const recentLogs = counts?.recentLogs ?? [];

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
          <div
            key={c.label}
            className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm"
          >
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
              <li
                key={l._id as unknown as string}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="font-semibold text-ink-900">{l.action}</div>
                  <div className="text-xs text-ink-500">
                    {l.entityType} · {l.entityId.slice(0, 12)}
                  </div>
                </div>
                <div className="text-xs text-ink-500">
                  {new Date(l.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
