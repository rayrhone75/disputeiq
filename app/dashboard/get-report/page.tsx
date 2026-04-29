import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth";
import { IdiqContinueButton } from "@/components/dashboard/IdiqContinueButton";
import { MarkActivatedButton } from "@/components/dashboard/MarkActivatedButton";
import { CreditReportStatusChip } from "@/components/dashboard/CreditReportStatusChip";
import { ConnectReportPanel } from "@/components/dashboard/ConnectReportPanel";
import { BookmarkletCard } from "@/components/dashboard/BookmarkletCard";
import { buildMsiqEnrollUrl, MSIQ, loadMsiqConfig } from "@/lib/integrations/myscoreiq";
import { loadCreditReportStatus } from "@/lib/credit-import/status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get your credit report — DisputeIQ",
  description:
    "Guided MyScoreIQ setup for DisputeIQ — activate your monitoring, connect your 3-bureau report, and start your dispute workflow.",
};

const HELPFUL_DOCS = [
  "Government-issued ID",
  "Proof of address",
  "Social Security verification (only if needed)",
  "Collection letters",
  "Credit denial letters",
  "Medical billing records (if relevant)",
  "Bankruptcy discharge or court paperwork",
  "Police report / identity theft affidavit (if relevant)",
  "Previous bureau responses",
  "Letters already sent to bureaus or creditors",
];

const WHAT_HAPPENS_NEXT = [
  { title: "Activate MyScoreIQ", detail: "Complete your monitoring setup first." },
  { title: "Connect Credit Report", detail: "Auto import JSON or upload manually." },
  { title: "Upload Documents", detail: "Add proof and supporting paperwork." },
  {
    title: "Review Report",
    detail: "DisputeIQ summarizes what needs attention.",
  },
  {
    title: "Agree and start disputes",
    detail: "Choose what to challenge and begin tracking.",
  },
];

// Status → which step is "current", which are "upcoming", which are "locked".
function stepStatus(
  kind: string,
  stepIndex: number,
): "current" | "upcoming" | "complete" | "locked" {
  const stateStep =
    kind === "not_started"
      ? 0
      : kind === "in_progress"
        ? 1
        : kind === "failed"
          ? 1
          : kind === "imported"
            ? 3
            : 0;
  if (stepIndex < stateStep) return "complete";
  if (stepIndex === stateStep) return "current";
  if (stepIndex === stateStep + 1) return "upcoming";
  return "locked";
}

export default async function GetReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const user = await requireUser();
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const params = (await searchParams) ?? {};
  const welcoming = params.welcome === "1";

  const [config, status] = await Promise.all([
    loadMsiqConfig(token),
    loadCreditReportStatus(token),
  ]);
  const msiqUrl = buildMsiqEnrollUrl({
    baseUrl: config.affiliateUrl,
    userId: user.id,
    campaign: "dashboard_get_report",
    source: "disputeiq",
  });

  const steps: Array<{
    n: string;
    title: string;
    body: string;
    cta: string;
    secondary?: string;
    status: ReturnType<typeof stepStatus>;
  }> = [
    {
      n: "01",
      title: "Activate MyScoreIQ",
      body:
        "Use your MyScoreIQ link to activate monitoring and report access. When finished, return here to continue.",
      cta: "Activate MyScoreIQ",
      secondary: "I already activated MyScoreIQ",
      status: stepStatus(status.kind, 0),
    },
    {
      n: "02",
      title: "Connect Credit Report",
      body:
        "Click connect to attempt automatic JSON import. If auto-connect isn't available, upload JSON or paste report data manually.",
      cta: "Connect Credit Report",
      secondary: "Upload JSON Manually / Paste Report JSON",
      status: stepStatus(status.kind, 1),
    },
    {
      n: "03",
      title: "Upload Documents",
      body:
        "Upload your ID, proof of address, prior bureau letters, collection notices, and any supporting evidence.",
      cta: "Upload Documents",
      secondary: "See recommended documents",
      status: stepStatus(status.kind, 2),
    },
    {
      n: "04",
      title: "Review Report",
      body:
        "Once your report is connected, review tradelines, inquiries, collections, public records, and dispute opportunities.",
      cta: "Review Report",
      secondary: "Go to dashboard",
      status: stepStatus(status.kind, 3),
    },
  ];

  const step1Status: string =
    status.kind === "not_started"
      ? "Waiting for MyScoreIQ activation"
      : status.kind === "in_progress"
        ? "Awaiting report import"
        : status.kind === "failed"
          ? "Last import failed — try again"
          : "Report imported";

  return (
    <div className="min-h-screen bg-canvas-app text-fg">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        {welcoming && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Welcome to DisputeIQ — your account is ready. Let&apos;s get your credit report
            connected.
          </div>
        )}

        {/* Top provider banner */}
        <div className="mb-6 rounded-3xl border border-violet-200 bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
                Supported provider
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Connect your MyScoreIQ report
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-fg-muted">
                DisputeIQ uses{" "}
                <span className="font-semibold text-fg">MyScoreIQ</span> for report access
                and monitoring. Activate MyScoreIQ, then return here to connect your report
                and continue onboarding.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <IdiqContinueButton href={msiqUrl} label="Activate MyScoreIQ" />
              <Link
                href="#connect"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm font-semibold text-fg transition hover:bg-surface-muted"
              >
                Connect Credit Report
              </Link>
            </div>
          </div>
        </div>

        {/* Live status + what-happens-next */}
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-violet-300">
                  Get Report Setup
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Your live status</h2>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Status</div>
                <div
                  className={`mt-1 text-sm font-semibold ${
                    status.kind === "imported"
                      ? "text-emerald-300"
                      : status.kind === "failed"
                        ? "text-rose-300"
                        : "text-amber-300"
                  }`}
                >
                  {step1Status}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <CreditReportStatusChip
                status={status}
                notStartedCtaHref={msiqUrl}
                eyebrow="Credit Report Status"
                className="!bg-transparent !border-0 !p-0 !shadow-none"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-border-strong bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">What happens next</h3>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Guided setup
              </span>
            </div>
            <div className="space-y-4">
              {WHAT_HAPPENS_NEXT.map((item, idx) => (
                <div key={item.title} className="flex gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      idx === 0 ? "bg-violet-600 text-white" : "bg-surface-muted text-fg-muted"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-fg">{item.title}</div>
                    <div className="text-sm leading-6 text-fg-muted">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Onboarding step cards + side panels */}
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div
            id="connect"
            className="rounded-3xl border border-border-strong bg-surface p-6 shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-fg-muted">Onboarding flow</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">How setup works</h2>
              </div>
              <Link
                href="/dashboard"
                className="rounded-2xl border border-border-strong px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-muted"
              >
                View full checklist
              </Link>
            </div>

            <div className="space-y-4">
              {steps.map((step, i) => {
                const statusStyle =
                  step.status === "current"
                    ? "border-violet-300 bg-violet-50"
                    : step.status === "upcoming"
                      ? "border-border-strong bg-surface"
                      : step.status === "complete"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-border-strong bg-surface-muted";
                const badgeStyle =
                  step.status === "current"
                    ? "bg-violet-600 text-white"
                    : step.status === "complete"
                      ? "bg-emerald-500 text-white"
                      : step.status === "upcoming"
                        ? "bg-surface-muted text-fg-muted"
                        : "bg-surface-muted text-fg-subtle";
                return (
                  <div key={step.n} className={`rounded-[28px] border p-5 ${statusStyle}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${badgeStyle}`}
                        >
                          {step.status === "complete" ? "✓" : step.n}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-fg">{step.title}</h3>
                          <p className="mt-1 max-w-2xl text-sm leading-7 text-fg-muted">
                            {step.body}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 lg:w-64">
                        {/* Primary CTA — wired per step */}
                        {i === 0 && <IdiqContinueButton href={msiqUrl} label={step.cta} />}
                        {i === 1 && (
                          <Link
                            href="#connect-panel"
                            className="rounded-2xl bg-fg px-4 py-3 text-center text-sm font-semibold text-canvas hover:opacity-90"
                          >
                            {step.cta}
                          </Link>
                        )}
                        {i === 2 && (
                          <Link
                            href="/dashboard/proof-vault"
                            className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
                              step.status === "locked"
                                ? "cursor-not-allowed bg-surface-muted text-fg-subtle pointer-events-none"
                                : "bg-fg text-canvas hover:opacity-90"
                            }`}
                          >
                            {step.cta}
                          </Link>
                        )}
                        {i === 3 && (
                          <Link
                            href="/dashboard/reports"
                            className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
                              step.status === "locked"
                                ? "cursor-not-allowed bg-surface-muted text-fg-subtle pointer-events-none"
                                : "bg-fg text-canvas hover:opacity-90"
                            }`}
                          >
                            {step.cta}
                          </Link>
                        )}

                        {/* Secondary — wired per step */}
                        {i === 0 && (
                          <MarkActivatedButton
                            label="I already activated MyScoreIQ"
                            scrollTo="#connect-panel"
                          />
                        )}
                        {i === 1 && (
                          <Link
                            href="#connect-panel"
                            className="rounded-2xl border border-border-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-fg hover:bg-surface-muted"
                          >
                            Upload JSON Manually
                          </Link>
                        )}
                        {i === 2 && (
                          <Link
                            href="#helpful-docs"
                            className="rounded-2xl border border-border-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-fg hover:bg-surface-muted"
                          >
                            See recommended documents
                          </Link>
                        )}
                        {i === 3 && (
                          <Link
                            href="/dashboard"
                            className="rounded-2xl border border-border-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-fg hover:bg-surface-muted"
                          >
                            Go to dashboard
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div id="connect-panel" className="scroll-mt-24">
              <ConnectReportPanel
                jsonReportUrl={config.jsonReportUrl}
                retryImportId={
                  status.kind === "failed" ? status.latestImportId : null
                }
              />
            </div>

            <BookmarkletCard clerkUserId={user.id} />

            <div
              id="helpful-docs"
              className="scroll-mt-24 rounded-3xl border border-border-strong bg-surface p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">Helpful documents to upload</h3>
              <p className="mt-2 text-sm leading-6 text-fg-muted">
                Upload what you already have now. You don&apos;t need every item to start, but
                more documentation gives you a stronger file.
              </p>
              <div className="mt-4 grid gap-3">
                {HELPFUL_DOCS.map((doc) => (
                  <div
                    key={doc}
                    className="flex items-start gap-3 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-fg-muted"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/proof-vault"
                className="mt-5 block w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-fg hover:bg-surface-muted"
              >
                Upload Documents
              </Link>
            </div>

            <div className="rounded-3xl border border-border-strong bg-surface p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
                Supported provider
              </p>
              <p className="mt-2 text-sm text-fg-muted">{MSIQ.supportedNote}</p>
              <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
                {config.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
