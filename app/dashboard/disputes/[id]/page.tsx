import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EscalationPanel } from "./escalation-panel";

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const dc = await prisma.disputeCase.findUnique({
    where: { id },
    include: { tradeline: true, mailJobs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!dc || dc.userId !== user.id) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "DisputeCase", entityId: id },
    orderBy: { createdAt: "asc" },
  });

  // Determine escalation eligibility
  const canEscalate = ["DELIVERED", "RESPONSE_RECEIVED", "ESCALATION_READY"].includes(dc.status);

  // Count prior disputes on same tradeline for stage suggestion
  const priorCount = dc.tradelineId
    ? await prisma.disputeCase.count({
        where: { tradelineId: dc.tradelineId, userId: user.id },
      })
    : 1;

  const suggestedStage =
    priorCount <= 1 ? "redispute" : priorCount === 2 ? "mov" : priorCount >= 3 ? "cfpb" : "redispute";

  const statusColor: Record<string, string> = {
    DRAFT: "bg-ink-100 text-ink-700",
    READY_FOR_PAYMENT: "bg-amber-100 text-amber-700",
    PAID: "bg-indigo-100 text-indigo-700",
    MAILED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-emerald-100 text-emerald-700",
    ESCALATION_READY: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/disputes" className="text-xs text-ink-500 hover:underline">
          ← All disputes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">
          {dc.tradeline?.creditorName ?? "Bureau packet"}
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor[dc.status] ?? "bg-ink-100 text-ink-700"}`}>
            {dc.status}
          </span>
          <span className="text-xs text-ink-500">
            {dc.letterType.replace(/_/g, " ")} · Case {dc.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink-900">Dispute basis</h2>
          <p className="mt-2 text-sm text-ink-700">{dc.aiReasonSummary}</p>
          {dc.legalBasisSummary && (
            <p className="mt-2 text-xs text-ink-500">{dc.legalBasisSummary}</p>
          )}
          {dc.tradeline && (
            <dl className="mt-4 space-y-1 text-xs text-ink-600">
              <div className="flex justify-between">
                <dt>Bureau</dt>
                <dd className="font-semibold">{dc.tradeline.bureau}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Account</dt>
                <dd className="font-semibold">{dc.tradeline.accountRefMasked}</dd>
              </div>
              {dc.tradeline.balanceCents != null && (
                <div className="flex justify-between">
                  <dt>Balance</dt>
                  <dd className="font-semibold">${(dc.tradeline.balanceCents / 100).toFixed(2)}</dd>
                </div>
              )}
              {dc.tradeline.statusLabel && (
                <div className="flex justify-between">
                  <dt>Status</dt>
                  <dd className="font-semibold">{dc.tradeline.statusLabel}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink-900">Locked preview</h2>
          <p className="mt-1 text-[10px] text-ink-500">
            Watermarked, screen-only. The mailable PDF is never downloadable.
          </p>
          <iframe
            title="letter preview"
            src={`/api/letters/preview?id=${dc.id}`}
            className="mt-3 h-64 w-full rounded-lg border border-ink-200"
          />
        </div>
      </div>

      {/* Action bar */}
      {dc.status === "DRAFT" && (
        <div className="rounded-2xl bg-ink-900 p-6 text-white">
          <h2 className="text-lg font-semibold">Ready to send?</h2>
          <p className="mt-1 text-sm text-white/70">
            Review the letter above, then proceed to the consent screen and payment.
          </p>
          <Link
            href={`/dashboard/checkout/${dc.id}`}
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink-900"
          >
            Continue to checkout →
          </Link>
        </div>
      )}

      {/* Escalation panel — only when delivered/unresolved */}
      {canEscalate && (
        <EscalationPanel
          disputeCaseId={dc.id}
          suggestedStage={suggestedStage}
          priorCount={priorCount}
          creditor={dc.tradeline?.creditorName ?? "Unknown"}
        />
      )}

      {/* Timeline */}
      <div className="rounded-2xl border border-ink-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-ink-900">Timeline</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-xs text-ink-500">No events yet.</p>
        ) : (
          <ol className="mt-4 space-y-2 text-xs">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3 text-ink-700">
                <span className="w-36 shrink-0 text-ink-500">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
                <span className="font-semibold">{l.action}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
