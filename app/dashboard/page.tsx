import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireUser } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/ui/primitives";
import { FreezePanel } from "@/components/dashboard/FreezePanel";
import { LetterChecker } from "@/components/dashboard/LetterChecker";
import { AssistantPanel } from "@/components/dashboard/AssistantPanel";
import { PacketMeter } from "@/components/dashboard/PacketMeter";
import { ExecutiveRail, type RailTile } from "@/components/dashboard/ExecutiveRail";
import { CreditReportStatusChip } from "@/components/dashboard/CreditReportStatusChip";
import { PLANS, type PlanCode } from "@/lib/billing/plans";

const PROGRESS_STEPS = [
  { key: "imported", label: "Imported" },
  { key: "analyzed", label: "Analyzed" },
  { key: "draft", label: "Draft Ready" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

export default async function DashboardOverview() {
  await requireUser();
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) {
    return (
      <div className="p-8 text-sm">
        Authentication token unavailable. Try refreshing.
      </div>
    );
  }

  const overview = await fetchQuery(api.onboarding.dashboardOverview, {}, { token });
  if (!overview) {
    return <div className="p-8 text-sm">Workspace not ready.</div>;
  }

  const {
    reports,
    tradelines,
    disputes,
    mailJobs,
    freezes,
    subscription,
    packetUsage,
    creditReportStatus,
    onboarding,
    user: dashUser,
  } = overview;

  const totalItems = tradelines.length;
  const disputableCount = disputes.filter((d) => d.status !== "CLOSED").length;
  const alreadyDisputed = disputes.length;
  const removed = disputes.filter((d) => d.status === "CLOSED").length;
  const remaining = Math.max(0, totalItems - alreadyDisputed);
  const verified = totalItems - disputableCount;

  const hasReport = reports.length > 0;
  const hasAnalysis = tradelines.length > 0;
  const hasDraft = disputes.some(
    (d) =>
      d.status === "DRAFT" ||
      d.status === "READY_FOR_PAYMENT" ||
      d.status === "PAID",
  );
  const hasSent = disputes.some(
    (d) =>
      d.status === "MAILED" ||
      d.status === "DELIVERED" ||
      d.status === "RESPONSE_RECEIVED" ||
      d.status === "CLOSED",
  );
  const hasDelivered = disputes.some(
    (d) =>
      d.status === "DELIVERED" ||
      d.status === "RESPONSE_RECEIVED" ||
      d.status === "CLOSED",
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

  const readyToRedispute = disputes.filter((d) => d.status === "ESCALATION_READY").length;
  const tradelineRedisputeCounts = new Map<string, number>();
  for (const d of disputes) {
    if (!d.tradelineId) continue;
    const key = d.tradelineId as unknown as string;
    tradelineRedisputeCounts.set(key, (tradelineRedisputeCounts.get(key) ?? 0) + 1);
  }
  const readyForCfpb = disputes.filter(
    (d) =>
      d.status === "ESCALATION_READY" &&
      d.tradelineId &&
      (tradelineRedisputeCounts.get(d.tradelineId as unknown as string) ?? 0) >= 2,
  ).length;

  const executiveRail: readonly RailTile[] = [
    {
      label: "Removed items",
      value: removed,
      hint: "Marked deleted by the bureau",
      tone: "emerald",
      href: "#dispute-history",
      icon: "check",
    },
    {
      label: "Remaining items",
      value: remaining,
      hint: "Parsed tradelines not yet disputed",
      tone: "indigo",
      href: "/dashboard/reports",
      icon: "list",
    },
    {
      label: "Ready to re-dispute",
      value: readyToRedispute,
      hint: "Delivered, not deleted",
      tone: "amber",
      href: "#letter-checker",
      icon: "clock",
    },
    {
      label: "Ready for CFPB",
      value: readyForCfpb,
      hint: "Re-disputed and still unresolved",
      tone: "rose",
      href: "#cfpb-queue",
      icon: "flag",
    },
  ];

  // Suppress unused-var warnings for fields surfaced for future panels.
  void dashUser;

  return (
    <div className="space-y-10">
      <SubscriptionBanner status={subscription?.status ?? null} />
      <OnboardingBanner state={onboarding} />

      <PageHeader
        eyebrow="Command center"
        title="Your dispute overview"
        description="Live state of every report, packet, and certified mail job in your file. No estimates."
      />

      <CreditReportStatusChip
        status={{
          ...creditReportStatus,
          lastUpdatedAt: creditReportStatus.lastUpdatedAt
            ? new Date(creditReportStatus.lastUpdatedAt)
            : null,
        }}
      />

      <ExecutiveRail tiles={executiveRail} />

      <PacketMeter
        planName={
          packetUsage.plan ? PLANS[packetUsage.plan as PlanCode].name : null
        }
        included={packetUsage.included}
        used={packetUsage.used}
        remaining={packetUsage.remaining}
        overageCents={packetUsage.overagePriceCents}
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border-strong bg-surface p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-fg-muted">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-fg">{c.value}</p>
          </div>
        ))}
      </section>

      <section
        id="dispute-history"
        className="scroll-mt-20 rounded-2xl border border-border-strong bg-gradient-to-br from-indigo-50 to-violet-50 p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-fg">AI analysis</h3>
          <Link
            href="/dashboard/reports"
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Open report →
          </Link>
        </div>
        {recentDisputes.length === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            No disputes yet. Upload a tri-merge report to begin — we'll surface every
            disputable item with confidence and recommended action.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {recentDisputes.map((d) => (
              <li
                key={d._id as unknown as string}
                className="rounded-xl bg-surface/80 p-4 ring-1 ring-border-strong"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-fg">
                    {d.tradeline?.creditorName ?? "Packet"}
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                    {d.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{d.aiReasonSummary}</p>
                {d.legalBasisSummary && (
                  <p className="mt-1 text-[11px] text-fg-subtle">{d.legalBasisSummary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border-strong bg-surface p-6">
        <h3 className="text-lg font-semibold text-fg">Dispute progress</h3>
        <ol className="mt-6 flex items-center justify-between gap-2">
          {PROGRESS_STEPS.map((step, i) => {
            const done = reached[i];
            return (
              <li key={step.key} className="flex flex-1 flex-col items-center text-center">
                <div
                  className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-indigo-600 text-white" : "bg-surface-muted text-fg-subtle"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${done ? "text-fg" : "text-fg-subtle"}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-border-strong bg-surface p-6">
        <h3 className="text-lg font-semibold text-fg">Recent certified mail</h3>
        {mailJobs.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">
            No certified mail in flight yet. When you send a packet, we'll track delivery
            and signature here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border text-sm">
            {mailJobs.slice(0, 5).map((j) => (
              <li
                key={j._id as unknown as string}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="font-semibold">
                    {j.providerJobId ?? (j._id as unknown as string)}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {j.trackingCode
                      ? `Tracking: ${j.trackingCode}`
                      : "Awaiting tracking number"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase text-indigo-600">
                    {j.status}
                  </div>
                  {j.deliveredAt && (
                    <div className="text-[10px] text-fg-muted">
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
            const dc = disputes.find((d) => d._id === j.disputeCaseId);
            return {
              disputeCaseId: j.disputeCaseId as unknown as string,
              creditor: dc?.tradeline?.creditorName ?? "Packet",
              bureau: dc?.tradeline?.bureau ?? "—",
              deliveredAt: new Date(j.deliveredAt!).toISOString(),
              trackingCode: j.trackingCode ?? null,
            };
          })
          .filter((d) => {
            const dc = disputes.find(
              (x) => (x._id as unknown as string) === d.disputeCaseId,
            );
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

      <FreezePanel
        initial={freezes.map((f) => ({
          id: f._id as unknown as string,
          provider: f.provider,
          status: f.status,
        }))}
      />

      <footer className="rounded-2xl border border-border-strong bg-surface-muted p-5 text-xs leading-relaxed text-fg-muted">
        DisputeIQ is a self-directed software platform that helps you analyze credit report
        data, prepare dispute packets, and track mailing and response activity. DisputeIQ is{" "}
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
          Your subscription payment failed. New disputes and packet sending are paused until
          your payment method is updated.
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

function OnboardingBanner({
  state,
}: {
  state: {
    step: "profile" | "subscription" | "report_connect" | "report_pending" | "ready";
  };
}) {
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
