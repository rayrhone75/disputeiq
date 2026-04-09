import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";

export default async function AdminReportsPage() {
  await requireRole(["OWNER", "ADMIN"]);

  const reports = await prisma.creditReport.findMany({
    include: {
      user: { select: { email: true } },
      tradelines: { select: { id: true } },
    },
    orderBy: { pulledAt: "desc" },
    take: 50,
  });

  // Fetch related audit logs for parser diagnostics
  const reportIds = reports.map((r) => r.id);
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "CreditReport",
      entityId: { in: reportIds },
    },
  });
  const logsByReport = new Map<string, typeof logs>();
  for (const l of logs) {
    if (!logsByReport.has(l.entityId)) logsByReport.set(l.entityId, []);
    logsByReport.get(l.entityId)!.push(l);
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
          <p className="text-sm text-ink-600">No reports uploaded yet.</p>
        </Surface>
      ) : (
        <Surface className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Uploaded</th>
                <th className="py-2 pr-3">Tradelines</th>
                <th className="py-2 pr-3">Parser flags</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const auditEntries = logsByReport.get(r.id) ?? [];
                const uploadLog = auditEntries.find((l) => l.action === "REPORT_UPLOADED" || l.action === "REPORT_PASTED");
                const meta = (uploadLog?.metadataJson as any) ?? {};
                const flags = Array.isArray(meta.reviewFlags) ? meta.reviewFlags : [];
                const tradelineCount = r.tradelines.length;
                const status = tradelineCount > 0 ? "parsed" : flags.length > 0 ? "partial/failed" : "empty";

                return (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="py-2 pr-3 font-mono">{r.user.email}</td>
                    <td className="py-2 pr-3">{r.source}</td>
                    <td className="py-2 pr-3">{r.pulledAt.toLocaleDateString()}</td>
                    <td className="py-2 pr-3 font-semibold">{tradelineCount}</td>
                    <td className="py-2 pr-3">
                      {flags.length > 0 ? (
                        <span className="text-amber-700">{flags.join(", ")}</span>
                      ) : (
                        <span className="text-ink-400">none</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        status === "parsed" ? "bg-emerald-100 text-emerald-700" :
                        status === "partial/failed" ? "bg-amber-100 text-amber-700" :
                        "bg-ink-100 text-ink-600"
                      }`}>
                        {status}
                      </span>
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
