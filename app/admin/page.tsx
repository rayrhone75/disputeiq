import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { AttentionFeed } from "./_components/AttentionFeed";

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

      <AttentionFeed />

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { href: "/admin/customers", label: "Customers", desc: "Customer 360" },
          { href: "/admin/credit-imports", label: "Imports", desc: "Reports" },
          { href: "/admin/mail-jobs", label: "Mail jobs", desc: "Certified mail" },
          { href: "/admin/audit-logs", label: "Audit log", desc: "Every event" },
          { href: "/admin/settings", label: "Settings", desc: "Platform config" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)]"
          >
            <div className="text-sm font-semibold text-fg">{l.label}</div>
            <div className="mt-0.5 text-[11px] text-fg-muted">{l.desc}</div>
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total users", value: userCount },
          { label: "Total disputes", value: disputeCount },
          { label: "Mail in flight", value: mailJobCount },
          { label: "Audit entries", value: recentLogs.length > 0 ? "Live" : "0" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border-strong bg-surface p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-fg-muted">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-fg">{c.value}</p>
          </div>
        ))}
      </section>

      <Surface className="p-6">
        <h2 className="text-lg font-semibold text-fg">Recent audit log</h2>
        {recentLogs.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">No audit entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border text-sm">
            {recentLogs.map((l) => (
              <li
                key={l._id as unknown as string}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="font-semibold text-fg">{l.action}</div>
                  <div className="text-xs text-fg-muted">
                    {l.entityType} · {l.entityId.slice(0, 12)}
                  </div>
                </div>
                <div className="text-xs text-fg-muted">
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
