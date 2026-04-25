import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { AdminReportDeleteButton } from "@/components/admin/AdminReportDeleteButton";

export default async function AdminReportsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });

  let reports: Awaited<ReturnType<typeof fetchQuery<typeof api.creditReports.adminList>>>;
  try {
    reports = await fetchQuery(
      api.creditReports.adminList,
      { limit: 50 },
      { token: token ?? undefined },
    );
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Report diagnostics"
        description="Uploaded reports, parser results, and troubleshooting data."
      />

      {reports.length === 0 ? (
        <Surface className="p-6">
          <p className="text-sm text-fg-muted">No reports uploaded yet.</p>
        </Surface>
      ) : (
        <Surface className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Uploaded</th>
                <th className="py-2 pr-3">Tradelines</th>
                <th className="py-2 pr-3">Parser flags</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const auditEntries = r.logs ?? [];
                const uploadLog = auditEntries.find(
                  (l) => l.action === "REPORT_UPLOADED" || l.action === "REPORT_PASTED",
                );
                const meta = (uploadLog?.metadataJson as Record<string, unknown> | undefined) ?? {};
                const flags = Array.isArray(meta.reviewFlags)
                  ? (meta.reviewFlags as string[])
                  : [];
                const tradelineCount = r.tradelines.length;
                const status =
                  tradelineCount > 0
                    ? "parsed"
                    : flags.length > 0
                      ? "partial/failed"
                      : "empty";

                return (
                  <tr key={r._id as unknown as string} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono">{r.user.email}</td>
                    <td className="py-2 pr-3">{r.source}</td>
                    <td className="py-2 pr-3">
                      {new Date(r.pulledAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 font-semibold">{tradelineCount}</td>
                    <td className="py-2 pr-3">
                      {flags.length > 0 ? (
                        <span className="text-amber-700">{flags.join(", ")}</span>
                      ) : (
                        <span className="text-fg-subtle">none</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          status === "parsed"
                            ? "bg-emerald-100 text-emerald-700"
                            : status === "partial/failed"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-surface-muted text-fg-muted"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <AdminReportDeleteButton reportId={r._id as unknown as string} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Surface>
      )}
    </div>
  );
}
