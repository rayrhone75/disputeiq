"use client";

import Link from "next/link";
import type { Aggregates, CustomerConsole } from "./types";

// Credit-file summary — section 3.
//
// Latest report card (provider, status, bureau coverage, age) + a stat
// row pulled from the aggregate (negatives / disputes sent / deletions
// / verified / remaining). Deep links to the existing admin import
// pages where the deeper detail lives.

const BUREAUS = ["EXPERIAN", "EQUIFAX", "TRANSUNION"] as const;
const BUREAU_LABEL: Record<(typeof BUREAUS)[number], string> = {
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
  TRANSUNION: "TransUnion",
};

export function CreditFileSummary({
  console: c,
  agg,
}: {
  console: CustomerConsole;
  agg: Aggregates;
}) {
  const latest = agg.latestImport;
  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Credit file
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Reports & dispute summary
          </h3>
        </div>
        {latest && (
          <Link
            href={`/admin/credit-imports?userId=${c.user._id}`}
            className="text-xs font-semibold text-fg-muted hover:text-fg"
          >
            View all imports →
          </Link>
        )}
      </div>

      {latest ? (
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-5 ring-1 ring-violet-200/60 dark:from-violet-500/15 dark:to-indigo-500/10 dark:ring-violet-500/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                Latest report
              </div>
              <div className="mt-1 text-base font-semibold text-fg">
                {latest.provider}
                <span className="ml-2 rounded-full bg-surface/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                  {latest.status}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-fg-muted">
                {latest.normalizedAt
                  ? `Imported ${formatDate(latest.normalizedAt)}`
                  : `Created ${formatDate(latest.createdAt)}`}
              </div>
            </div>
            <Link
              href={`/admin/credit-imports/${latest._id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90"
            >
              Open report
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Bureau chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {BUREAUS.map((b) => {
              const present = agg.bureausDetected.has(b);
              return (
                <span
                  key={b}
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ring-inset",
                    present
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
                      : "bg-surface-muted text-fg-subtle ring-border",
                  ].join(" ")}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${present ? "bg-emerald-500" : "bg-fg-subtle/40"}`}
                  />
                  {BUREAU_LABEL[b]}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface-muted/40 p-6 text-center">
          <p className="text-sm font-semibold text-fg">No reports yet</p>
          <p className="mt-1 text-[12px] text-fg-muted">
            This customer hasn&apos;t connected a credit report. The
            Connect-MyScoreIQ flow lives at{" "}
            <Link
              href="/dashboard/get-report"
              className="underline hover:text-fg"
            >
              /dashboard/get-report
            </Link>
            .
          </p>
        </div>
      )}

      {/* Stat row */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Negatives" value={agg.totalNegatives} tone="rose" />
        <Stat label="Disputes sent" value={agg.disputesSent} tone="indigo" />
        <Stat label="Deletions" value={agg.deletions} tone="emerald" />
        <Stat label="Verified" value={agg.verified} tone="sky" />
        <Stat label="Remaining" value={agg.remaining} tone="amber" />
        <Stat label="Candidates" value={agg.totalCandidates} tone="violet" />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "indigo" | "rose" | "sky" | "amber" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-700 dark:text-emerald-200",
    indigo: "text-indigo-700 dark:text-indigo-200",
    rose: "text-rose-700 dark:text-rose-200",
    sky: "text-sky-700 dark:text-sky-200",
    amber: "text-amber-700 dark:text-amber-200",
    violet: "text-violet-700 dark:text-violet-200",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${tones[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
