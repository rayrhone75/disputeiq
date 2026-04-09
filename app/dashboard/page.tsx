import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { FreezePanel } from "@/components/dashboard/FreezePanel";
import { LetterChecker } from "@/components/dashboard/LetterChecker";
import { AssistantPanel } from "@/components/dashboard/AssistantPanel";
import { listFreezesForUser } from "@/lib/freeze";

const PROGRESS_STEPS = [
  { key: "imported", label: "Imported" },
  { key: "analyzed", label: "Analyzed" },
  { key: "draft", label: "Draft Ready" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

export default async function DashboardOverview() {
  const user = await requireUser();

  const [reports, tradelines, disputes, mailJobs, freezes] = await Promise.all([
    prisma.creditReport.findMany({
      where: { userId: user.id },
      include: { tradelines: true },
      orderBy: { pulledAt: "desc" },
    }),
    prisma.tradeline.findMany({ where: { report: { userId: user.id } } }),
    prisma.disputeCase.findMany({
      where: { userId: user.id },
      include: { tradeline: true },
      orderBy: { id: "desc" },
    }),
    prisma.mailJob.findMany({
      where: { disputeCase: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    listFreezesForUser(user.id),
  ]);

  const totalItems = tradelines.length;
  const disputableCount = disputes.filter((d) => d.status !== "CLOSED").length;
  const alreadyDisputed = disputes.length;
  const removed = disputes.filter((d) => d.status === "CLOSED").length;
  const remaining = Math.max(0, totalItems - alreadyDisputed);
  const verified = totalItems - disputableCount;

  const hasReport = reports.length > 0;
  const hasAnalysis = tradelines.length > 0;
  const hasDraft = disputes.some(
    (d) => d.status === "DRAFT" || d.status === "READY_FOR_PAYMENT" || d.status === "PAID",
  );
  const hasSent = disputes.some(
    (d) =>
      d.status === "MAILED" ||
      d.status === "DELIVERED" ||
      d.status === "RESPONSE_RECEIVED" ||
      d.status === "CLOSED",
  );
  const hasDelivered = disputes.some(
    (d) => d.status === "DELIVERED" || d.status === "RESPONSE_RECEIVED" || d.status === "CLOSED",
  );
  const hasCompleted = disputes.some((d) => d.status === "CLOSED");
  const reached = [hasReport, hasAnalysis, hasDraft, hasSent, hasDelivered, hasCompleted];

  const summaryCards = [
    { label: "Total items", value: totalItems },
    { label: "Verified", value: verified },
    { label: "Needs review", value: disputableCount },
    { label: "Disputable", value: disputableCount },
    { label: "Already disputed", value: alreadyDisputed },
    { label: "Removed", value: removed },
    { label: "Remaining", value: remaining },
  ];

  const recentDisputes = disputes.slice(0, 5);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Command center"
        title="Your dispute overview"
        description="Live state of every report, packet, and certified mail job in your file. No estimates."
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-ink-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-ink-900">AI analysis</h3>
          <Link
            href="/dashboard/reports"
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Open report →
          </Link>
        </div>
        {recentDisputes.length === 0 ? (
          <p className="mt-4 text-sm text-ink-600">
            No disputes yet. Upload a tri-merge report to begin — we'll surface every disputable item with confidence and recommended action.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {recentDisputes.map((d) => (
              <li key={d.id} className="rounded-xl bg-white/80 p-4 ring-1 ring-ink-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink-900">
                    {d.tradeline?.creditorName ?? "Packet"}
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                    {d.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-700">{d.aiReasonSummary}</p>
                {d.legalBasisSummary && (
                  <p className="mt-1 text-[11px] text-ink-500">{d.legalBasisSummary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-ink-900">Dispute progress</h3>
        <ol className="mt-6 flex items-center justify-between gap-2">
          {PROGRESS_STEPS.map((step, i) => {
            const done = reached[i];
            return (
              <li key={step.key} className="flex flex-1 flex-col items-center text-center">
                <div
                  className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-indigo-600 text-white" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${done ? "text-ink-900" : "text-ink-400"}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-ink-900">Recent certified mail</h3>
        {mailJobs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600">
            No certified mail in flight yet. When you send a packet, we'll track delivery and signature here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100 text-sm">
            {mailJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold">{j.providerJobId ?? j.id}</div>
                  <div className="text-xs text-ink-500">
                    {j.trackingCode ? `Tracking: ${j.trackingCode}` : "Awaiting tracking number"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase text-indigo-600">{j.status}</div>
                  {j.deliveredAt && (
                    <div className="text-[10px] text-ink-500">
                      delivered {new Date(j.deliveredAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LetterChecker
        delivered={mailJobs
          .filter((j) => j.status === "DELIVERED" && j.deliveredAt)
          .map((j) => {
            const dc = disputes.find((d) => d.id === j.disputeCaseId);
            return {
              disputeCaseId: j.disputeCaseId,
              creditor: dc?.tradeline?.creditorName ?? "Packet",
              bureau: dc?.tradeline?.bureau ?? "—",
              deliveredAt: j.deliveredAt!.toISOString(),
              trackingCode: j.trackingCode,
            };
          })
          .filter((d) => {
            const dc = disputes.find((x) => x.id === d.disputeCaseId);
            return dc && dc.status !== "CLOSED" && dc.status !== "ESCALATION_READY";
          })}
      />

      <AssistantPanel />

      <FreezePanel initial={freezes.map((f) => ({ id: f.id, provider: f.provider, status: f.status }))} />

      <footer className="rounded-2xl border border-ink-200 bg-ink-50 p-5 text-xs leading-relaxed text-ink-600">
        DisputeIQ does not guarantee any specific credit score change, item removal, or financial outcome.
        Results vary by case. We do not provide legal or financial advice. We operate under your existing
        rights as a consumer under the Fair Credit Reporting Act (FCRA, 15 U.S.C. §1681 et seq.).
      </footer>
    </div>
  );
}
