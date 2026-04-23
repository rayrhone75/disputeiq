// Customer-facing credit-report status card.
//
// Pure presentation: takes a `CreditReportStatusSummary` (derived elsewhere
// from the CreditReportImport pipeline, legacy CreditReport rows, and the
// IDIQ_CLICK audit signal) and renders a premium status pill + next-step
// CTA. Does not read from the DB; does not introduce a second source of truth.

import Link from "next/link";
import type { CreditReportStatusSummary } from "@/lib/credit-import/status";

type Tone = "neutral" | "indigo" | "emerald" | "rose";

type StatusMeta = {
  label: string;
  tone: Tone;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  pulse: boolean;
};

const STATUS_META: Record<CreditReportStatusSummary["kind"], StatusMeta> = {
  not_started: {
    label: "Not Started",
    tone: "neutral",
    description:
      "You haven't started your credit report yet. DisputeIQ works best with our supported IDIQ flow.",
    ctaLabel: "Continue with IDIQ",
    ctaHref: "/dashboard/get-report",
    pulse: false,
  },
  in_progress: {
    label: "In Progress",
    tone: "indigo",
    description:
      "We're waiting on your IdentityIQ report. Finish the IDIQ signup, pull your 3-bureau file, then come back here.",
    ctaLabel: "I completed my report",
    ctaHref: "/dashboard/reports",
    pulse: true,
  },
  imported: {
    label: "Imported",
    tone: "emerald",
    description:
      "Your credit report is imported and analyzed. Review your dispute plan to see what to challenge next.",
    ctaLabel: "View dispute plan",
    ctaHref: "/dashboard/disputes",
    pulse: false,
  },
  failed: {
    label: "Failed",
    tone: "rose",
    description:
      "The last import didn't finish. Try the import again — the original file is still preserved for support.",
    ctaLabel: "Retry import",
    ctaHref: "/dashboard/reports",
    pulse: false,
  },
};

const TONE_CLASSES: Record<
  Tone,
  { pill: string; dot: string; border: string; bg: string; cta: string; ring: string }
> = {
  neutral: {
    pill: "bg-ink-100 text-ink-700",
    dot: "bg-ink-400",
    border: "border-ink-200",
    bg: "bg-white",
    cta: "bg-ink-900 text-white hover:bg-ink-800",
    ring: "ring-ink-200",
  },
  indigo: {
    pill: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
    bg: "bg-gradient-to-br from-indigo-50 to-white",
    cta: "bg-indigo-600 text-white hover:bg-indigo-700",
    ring: "ring-indigo-200",
  },
  emerald: {
    pill: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    bg: "bg-gradient-to-br from-emerald-50 to-white",
    cta: "bg-emerald-600 text-white hover:bg-emerald-700",
    ring: "ring-emerald-200",
  },
  rose: {
    pill: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    border: "border-rose-200",
    bg: "bg-gradient-to-br from-rose-50 to-white",
    cta: "bg-rose-600 text-white hover:bg-rose-700",
    ring: "ring-rose-200",
  },
};

function fmt(d: Date | string | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toLocaleString();
}

export function CreditReportStatusChip({
  status,
  notStartedCtaHref,
  hideCta = false,
  compact = false,
  eyebrow = "Credit Report Status",
  className,
}: {
  status: CreditReportStatusSummary;
  /**
   * Override the CTA destination when status is `not_started`. Used on the
   * `/dashboard/get-report` page so the chip's CTA jumps straight to IDIQ
   * instead of looping back to the same page.
   */
  notStartedCtaHref?: string;
  hideCta?: boolean;
  /** Render a single-line inline variant (omits description + eyebrow). */
  compact?: boolean;
  eyebrow?: string;
  className?: string;
}) {
  const meta = STATUS_META[status.kind];
  const tone = TONE_CLASSES[meta.tone];
  const ctaHref =
    status.kind === "not_started" && notStartedCtaHref
      ? notStartedCtaHref
      : meta.ctaHref;
  const ctaExternal = /^https?:\/\//.test(ctaHref);
  const lastUpdated = fmt(status.lastUpdatedAt);

  if (compact) {
    return (
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
          tone.pill,
          tone.ring,
          className ?? "",
        ].join(" ")}
      >
        <span
          className={[
            "h-1.5 w-1.5 rounded-full",
            tone.dot,
            meta.pulse ? "animate-pulse" : "",
          ].join(" ")}
        />
        {meta.label}
      </span>
    );
  }

  return (
    <section
      aria-label={`${eyebrow}: ${meta.label}`}
      className={[
        "rounded-2xl border p-5 shadow-sm",
        tone.border,
        tone.bg,
        className ?? "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            {eyebrow}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                tone.pill,
                tone.ring,
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  tone.dot,
                  meta.pulse ? "animate-pulse" : "",
                ].join(" ")}
              />
              {meta.label}
            </span>
            {lastUpdated && (
              <span className="text-[11px] text-ink-500">Updated {lastUpdated}</span>
            )}
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-700">
            {meta.description}
          </p>
        </div>
        {!hideCta && (
          <div className="shrink-0">
            {ctaExternal ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition",
                  tone.cta,
                ].join(" ")}
              >
                {meta.ctaLabel}
              </a>
            ) : (
              <Link
                href={ctaHref}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition",
                  tone.cta,
                ].join(" ")}
              >
                {meta.ctaLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export { STATUS_META };
