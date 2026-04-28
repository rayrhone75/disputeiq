import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { FollowUpBadge } from "@/components/dashboard/FollowUpBadge";

export default async function DisputesPage() {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("UNAUTHENTICATED");
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("UNAUTHENTICATED");

  const disputes = await fetchQuery(api.disputes.listForUser, {}, { token });

  const byStatus = (s: string[]) => disputes.filter((d) => s.includes(d.status));
  const active = byStatus(["DRAFT", "NEEDS_USER_CONFIRMATION", "READY_FOR_PAYMENT", "PAID", "MAILED"]);
  const delivered = byStatus(["DELIVERED", "RESPONSE_RECEIVED"]);
  const closed = byStatus(["CLOSED", "ESCALATION_READY"]);

  const statusColor: Record<string, string> = {
    DRAFT: "bg-surface-muted text-fg-muted",
    READY_FOR_PAYMENT: "bg-amber-100 text-amber-700",
    PAID: "bg-indigo-100 text-indigo-700",
    MAILED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-emerald-100 text-emerald-700",
    ESCALATION_READY: "bg-rose-100 text-rose-700",
  };

  function DisputeRow({ d }: { d: (typeof disputes)[number] }) {
    return (
      <li className="flex items-center justify-between py-3">
        <div>
          <div className="font-semibold text-fg">
            {d.tradeline?.creditorName ?? "Bureau packet"}
          </div>
          <div className="text-xs text-fg-muted">
            {d.letterType.replace(/_/g, " ")} · {d.aiReasonSummary.slice(0, 80)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FollowUpBadge
            responseDueAt={d.responseDueAt ? new Date(d.responseDueAt) : null}
            status={d.status}
          />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor[d.status] ?? "bg-surface-muted text-fg-muted"}`}>
            {d.status}
          </span>
          {d.status === "DRAFT" && (
            <Link href={`/dashboard/checkout/${d._id}`} className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-fg/90">
              Continue →
            </Link>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Disputes"
        title="Your dispute cases"
        description="Every dispute packet you've drafted, sent, or received a response on."
        actions={
          <Link href="/dashboard/reports" className="rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:bg-fg/90">
            New dispute from report →
          </Link>
        }
      />

      {disputes.length === 0 ? (
        <Surface className="p-10 text-center">
          <h2 className="text-lg font-semibold text-fg">No disputes yet</h2>
          <p className="mt-2 text-sm text-fg-muted">
            Upload a credit report, run the AI analysis, and select items to dispute. Your dispute history will appear here.
          </p>
          <Link href="/dashboard/reports" className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
            Upload a report
          </Link>
        </Surface>
      ) : (
        <>
          {active.length > 0 && (
            <Surface className="p-6">
              <h2 className="text-lg font-semibold text-fg">Active ({active.length})</h2>
              <ul className="mt-4 divide-y divide-border text-sm">
                {active.map((d) => <DisputeRow key={d._id} d={d} />)}
              </ul>
            </Surface>
          )}
          {delivered.length > 0 && (
            <Surface className="p-6">
              <h2 className="text-lg font-semibold text-fg">Delivered — awaiting response ({delivered.length})</h2>
              <ul className="mt-4 divide-y divide-border text-sm">
                {delivered.map((d) => <DisputeRow key={d._id} d={d} />)}
              </ul>
            </Surface>
          )}
          {closed.length > 0 && (
            <Surface className="p-6">
              <h2 className="text-lg font-semibold text-fg">Resolved ({closed.length})</h2>
              <ul className="mt-4 divide-y divide-border text-sm">
                {closed.map((d) => <DisputeRow key={d._id} d={d} />)}
              </ul>
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
