import { prisma } from "@/lib/prisma";

export default async function AuditLogsPage() {
  let logs: { id: string; action: string; entityType: string; entityId: string; createdAt: Date }[] = [];
  try {
    logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  } catch {
    // DB not configured locally yet — render empty.
  }
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Audit logs</h1>
      <table className="mt-6 w-full text-sm">
        <thead><tr className="text-left"><th>Time</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td>{l.createdAt.toISOString()}</td>
              <td>{l.action}</td>
              <td>{l.entityType}:{l.entityId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
