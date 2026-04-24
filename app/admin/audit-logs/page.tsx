import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";

export default async function AuditLogsPage() {
  await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });

  const logs = token
    ? await fetchQuery(api.auditLogs.recent, { limit: 100 }, { token }).catch(
        () => [] as Array<{
          _id: string;
          action: string;
          entityType: string;
          entityId: string;
          createdAt: number;
        }>,
      )
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Audit logs</h1>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Time</th>
            <th>Action</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id as unknown as string} className="border-t">
              <td>{new Date(l.createdAt).toISOString()}</td>
              <td>{l.action}</td>
              <td>
                {l.entityType}:{l.entityId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
