import { requireUser } from "@/lib/auth";
import { IdiqContinueButton } from "@/components/dashboard/IdiqContinueButton";
import { CreditReportStatusChip } from "@/components/dashboard/CreditReportStatusChip";
import { buildIdiqEnrollUrl, IDIQ, loadIdiqConfig } from "@/lib/integrations/identityiq";
import { loadCreditReportStatus } from "@/lib/credit-import/status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get your credit report — DisputeIQ",
  description:
    "Continue into the IDIQ-connected credit report flow. DisputeIQ works best with the IDIQ report source for accurate import and dispute workflow.",
};

export default async function GetReportPage() {
  const user = await requireUser();
  const config = await loadIdiqConfig();
  const url = buildIdiqEnrollUrl({
    baseUrl: config.affiliateUrl,
    userId: user.id,
    campaign: "dashboard_get_report",
    source: "disputeiq",
  });

  const status = await loadCreditReportStatus(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Step · Get your credit report
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Get Started with Your Credit Report
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-600">
          To use DisputeIQ successfully, begin with our supported credit report provider flow.
          We&apos;ve built the platform to work with the IDIQ-connected report experience so
          your data imports more reliably and your dispute workflow stays accurate.
        </p>
      </header>

      <CreditReportStatusChip
        status={status}
        notStartedCtaHref={url}
        eyebrow="Credit Report Status"
      />

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <CreditReportStatusChip status={status} compact hideCta />
          <p className="text-sm font-semibold text-ink-900">
            Provider: {config.displayName || IDIQ.productName}
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-ink-900">Continue with IDIQ</p>
            <p className="mt-1 text-sm text-ink-600">{IDIQ.supportedNote}</p>
          </div>
          <IdiqContinueButton href={url} label="Continue with IDIQ" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Why IDIQ",
            body:
              "IdentityIQ delivers a clean 3-bureau file that DisputeIQ parses reliably, so your findings and dispute letters reference accurate data.",
          },
          {
            title: "What happens next",
            body:
              "Finish the IDIQ signup, pull your report, then return here. Your DisputeIQ workspace will be ready to import and analyze the report.",
          },
          {
            title: "Private by design",
            body:
              "Your report stays private. DisputeIQ encrypts sensitive data at rest and never shares your personal information without your confirmation.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
              {card.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-semibold text-ink-900">How the IDIQ flow works</p>
        <ol className="mt-3 space-y-2 text-sm text-ink-700">
          {(config.instructions || "").split("\n").map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-6">
        <p className="text-sm font-semibold text-ink-900">Need help?</p>
        <p className="mt-1 text-sm text-ink-600">
          Our support team can guide you through the setup process. Email{" "}
          <a className="text-indigo-700 underline" href="mailto:support@disputeiq.org">
            support@disputeiq.org
          </a>{" "}
          if you get stuck.
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500">{config.disclaimer}</p>
    </div>
  );
}
