import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { FreezePanel } from "@/components/dashboard/FreezePanel";
import { LetterChecker } from "@/components/dashboard/LetterChecker";
import { AssistantPanel } from "@/components/dashboard/AssistantPanel";
import { PacketMeter } from "@/components/dashboard/PacketMeter";
import { CreditReportStatusChip } from "@/components/dashboard/CreditReportStatusChip";
import { loadCreditReportStatus } from "@/lib/credit-import/status";
import { listFreezesForUser } from "@/lib/freeze";
import { getUserPacketUsage } from "@/lib/billing/usage";
import { PLANS } from "@/lib/billing/plans";
import { getOnboardingState } from "@/lib/onboarding";

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

  const [reports, tradelines, disputes, mailJobs, freezes, packetUsage, creditReportStatus] =
    await Promise.all([
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
      getUserPacketUsage(user.id),
      loadCreditReportStatus(user.id),
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

  // Executive top rail counts — derived from real DisputeCase state.
  // Removed         = disputes the user has marked CLOSED via the Letter Checker
  // Remaining       = parsed tradelines that have never been included in a dispute
  // Ready re-dispute = delivered packets the user marked failed (or auto-flagged ESCALATION_READY)
  // Ready CFPB      = ESCALATION_READY items that have already been re-disputed at least once
  const readyToRedispute = disputes.filter((d) => d.status === "ESCALATION_READY").length;
  const tradelineRedisputeCounts = new Map<string, number>();
  for (const d of disputes) {
    if (!d.tradelineId) continue;
    tradelineRedisputeCounts.set(
      d.tradelineId,
      (tradelineRedisputeCounts.get(d.tradelineId) ?? 0) + 1,
    );
  }
  const readyForCfpb = disputes.filter(
    (d) =>
      d.status === "ESCALATION_READY" &&
      d.tradelineId &&
      (tradelineRedisputeCounts.get(d.tradelineId) ?? 0) >= 2,
  ).length;

  const executiveRail = [
    {
      label: "Removed items",
      value: removed,
      hint: "Marked deleted by the bureau",
      tone: "emerald",
      href: "#dispute-history",
    },
    {
      label: "Remaining items",
      value: remaining,
      hint: "Parsed tradelines not yet disputed",
      tone: "indigo",
      href: "/dashboard/reports",
    },
    {
      label: "Ready to re-dispute",
      value: readyToRedispute,
      hint: "Delivered, not deleted",
      tone: "amber",
      href: "#letter-checker",
    },
    {
      label: "Ready for CFPB",
      value: readyForCfpb,
      hint: "Re-disputed and still unresolved",
      tone: "rose",
      href: "#cfpb-queue",
    },
  ] as const;

  const toneRing: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 ring-emerald-200",
    indigo: "from-indigo-500/20 to-indigo-500/5 ring-indigo-200",
    amber: "from-amber-500/20 to-amber-500/5 ring-amber-200",
    rose: "from-rose-500/20 to-rose-500/5 ring-rose-200",
  };
  const toneText: Record<string, string> = {
    emerald: "text-emerald-700",
    indigo: "text-indigo-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };

  return (
    <div className="space-y-10">
      <SubscriptionBanner status={packetUsage.plan ? (await prisma.userSubscription.findUnique({ where: { userId: user.id } }))?.status ?? null : null} />
      <OnboardingBanner userId={user.id} />

      <PageHeader
        eyebrow="Command center"
        title="Your dispute overview"
        description="Live state of every report, packet, and certified mail job in your file. No estimates."
      />

      <CreditReportStatusChip status={creditReportStatus} />

      {/* Executive top rail — premium high-signal status */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {executiveRail.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${toneRing[c.tone]} p-6 ring-1 transition hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${toneText[c.tone]}`}>
              {c.label}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-ink-900">{c.value}</p>
            <p className="mt-1 text-xs text-ink-600">{c.hint}</p>
            <span className="absolute right-4 top-4 text-xs text-ink-400 opacity-0 transition group-hover:opacity-100">
              →
            </span>
          </Link>
        ))}
      </section>

      <PacketMeter
        planName={packetUsage.plan ? PLANS[packetUsage.plan].name : null}
        included={packetUsage.included}
        used={packetUsage.used}
        remaining={packetUsage.remaining}
        overageCents={packetUsage.overagePriceCents}
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-ink-500">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">{c.value}</p>
          </div>
        ))}
      </section>

      <section
        id="dispute-history"
        className="scroll-mt-20 rounded-2xl border border-ink-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6"
      >
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

      <div id="letter-checker" className="scroll-mt-20" />
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

      <section
        id="cfpb-queue"
        className="scroll-mt-20 rounded-2xl border border-rose-200 bg-rose-50/50 p-6"
      >
        <h3 className="text-lg font-semibold text-rose-900">CFPB escalation queue</h3>
        <p className="mt-1 text-sm text-rose-900/75">
          {readyForCfpb === 0
            ? "No items here yet. An item lands in this queue after it has been disputed and re-disputed without resolution."
            : `${readyForCfpb} item(s) have been disputed twice without resolution and are eligible for a CFPB complaint. The CFPB packet generator will bundle dispute history, certified mail proofs, and any uploaded bureau responses into a complaint draft you review before submitting.`}
        </p>
      </section>

      <AssistantPanel />

      <FreezePanel initial={freezes.map((f) => ({ id: f.id, provider: f.provider, status: f.status }))} />

      <footer className="rounded-2xl border border-ink-200 bg-ink-50 p-5 text-xs leading-relaxed text-ink-600">
        DisputeIQ is a self-directed software platform that helps you analyze credit report data,
        prepare dispute packets, and track mailing and response activity. DisputeIQ is{" "}
        <strong>not a credit repair agency, law firm, or credit bureau</strong>, and does not
        guarantee deletions, score increases, or specific outcomes. You authorize each action
        yourself. We operate under your existing rights as a consumer under the Fair Credit
        Reporting Act (FCRA, 15 U.S.C. §1681 et seq.).
      </footer>
    </div>
  );
}

function SubscriptionBanner({ status }: { status: string | null }) {
  if (!status || status === "active") return null;

  if (status === "past_due") {
    return (
      <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-6">
        <h2 className="text-lg font-semibold text-rose-900">Payment failed</h2>
        <p className="mt-1 text-sm text-rose-900/75">
          Your subscription payment failed. New disputes and packet sending are paused
          until your payment method is updated.
        </p>
        <p className="mt-3 text-xs text-rose-900/60">
          Your card on file may have expired or been declined. Update your payment method
          through Square, or contact support@disputeiq.org for help.
        </p>
      </section>
    );
  }

  if (status === "canceled") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6">
        <h2 className="text-lg font-semibold text-amber-900">Subscription canceled</h2>
        <p className="mt-1 text-sm text-amber-900/75">
          Your plan is no longer active. You can still view your history, but new disputes
          require an active subscription.
        </p>
        <Link
          href="/dashboard/onboarding"
          className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Resubscribe →
        </Link>
      </section>
    );
  }

  return null;
}

async function OnboardingBanner({ userId }: { userId: string }) {
  const state = await getOnboardingState(userId);
  if (state.step === "ready") return null;

  const msgs: Record<string, { title: string; body: string; href: string; label: string }> = {
    profile: {
      title: "Complete your profile",
      body: "We need your mailing address and identity details to generate dispute letters on your behalf.",
      href: "/dashboard/onboarding",
      label: "Set up profile →",
    },
    subscription: {
      title: "Choose a plan",
      body: "Select Starter, Pro, or Elite to unlock your monthly dispute packets.",
      href: "/dashboard/onboarding",
      label: "Choose plan →",
    },
    report_connect: {
      title: "Get your credit report",
      body: "Continue with IDIQ — our supported credit report provider — to pull your 3-bureau file into DisputeIQ.",
      href: "/dashboard/get-report",
      label: "Continue with IDIQ →",
    },
    report_pending: {
      title: "Report needs attention",
      body: "Your report was uploaded but we couldn't parse tradelines. Try re-uploading.",
      href: "/dashboard/reports",
      label: "Re-upload →",
    },
  };

  const m = msgs[state.step];
  if (!m) return null;

  return (
    <section className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/80 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-indigo-900">{m.title}</h2>
          <p className="mt-1 text-sm text-indigo-900/75">{m.body}</p>
        </div>
        <Link
          href={m.href}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
        >
          {m.label}
        </Link>
      </div>
    </section>
  );
}
