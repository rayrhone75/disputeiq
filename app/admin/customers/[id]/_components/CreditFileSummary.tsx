"use client";

import Link from "next/link";
import type { Aggregates, CustomerConsole, TimelineRow } from "./types";

// Credit-file summary — section 3.
//
// Latest report card (provider, status, bureau coverage, age) + a stat
// row pulled from the aggregate (negatives / disputes sent / deletions
// / verified / remaining) + an "Import journey" mini-timeline that
// surfaces assisted-import progress when the customer 360 timeline
// shows admin link issuance + customer import attempts.

const BUREAUS = ["EXPERIAN", "EQUIFAX", "TRANSUNION"] as const;
const BUREAU_LABEL: Record<(typeof BUREAUS)[number], string> = {
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
  TRANSUNION: "TransUnion",
};

const IMPORT_JOURNEY_ACTIONS = new Set([
  "ADMIN_IMPORT_LINK_ISSUED",
  "BOOKMARKLET_IMPORT_ATTEMPT",
  "BOOKMARKLET_IMPORT_SUCCESS",
  "BOOKMARKLET_IMPORT_FAILED",
  "CREDIT_IMPORT_NORMALIZED",
  "CREDIT_IMPORT_FAILED",
  "REPORT_PASTED",
]);

export function CreditFileSummary({
  console: c,
  agg,
  timeline = [],
}: {
  console: CustomerConsole;
  agg: Aggregates;
  timeline?: TimelineRow[];
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

      <ImportJourney rows={timeline} />

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

function ImportJourney({ rows }: { rows: TimelineRow[] }) {
  const journey = rows
    .filter((r) => IMPORT_JOURNEY_ACTIONS.has(r.action))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);
  if (journey.length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-border bg-surface-muted/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
        Assisted-import journey
      </p>
      <ol className="mt-2 space-y-1.5">
        {journey.map((r) => {
          const meta = describeJourney(r);
          return (
            <li key={r._id} className="flex items-start gap-2.5 text-[12px]">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-fg">{meta.title}</span>
                {meta.detail && (
                  <span className="text-fg-muted"> · {meta.detail}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-fg-subtle">
                {formatRelative(r.createdAt)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function describeJourney(r: TimelineRow): {
  title: string;
  detail: string;
  dot: string;
} {
  const meta = (r.metadataJson ?? {}) as Record<string, unknown>;
  switch (r.action) {
    case "ADMIN_IMPORT_LINK_ISSUED":
      return {
        title: "Admin issued import link",
        detail: "Customer can sign in via magic link and connect MyScoreIQ.",
        dot: "bg-violet-500",
      };
    case "BOOKMARKLET_IMPORT_ATTEMPT":
      return {
        title: "Customer started import",
        detail:
          typeof meta.payloadBytes === "number"
            ? `Connector running (${Math.round(
                (meta.payloadBytes as number) / 1024,
              )} KB payload)`
            : "Connector running",
        dot: "bg-sky-500",
      };
    case "BOOKMARKLET_IMPORT_SUCCESS":
      return {
        title: "Import succeeded",
        detail:
          typeof meta.tradelineCount === "number"
            ? `${meta.tradelineCount} tradelines normalized`
            : "Report normalized",
        dot: "bg-emerald-500",
      };
    case "CREDIT_IMPORT_NORMALIZED":
      return {
        title: "Report normalized",
        detail: "Tradelines, inquiries, and dispute candidates ready.",
        dot: "bg-emerald-500",
      };
    case "BOOKMARKLET_IMPORT_FAILED":
    case "CREDIT_IMPORT_FAILED":
      return {
        title: "Import failed",
        detail:
          typeof meta.code === "string"
            ? (meta.code as string)
            : "Customer or pipeline error",
        dot: "bg-rose-500",
      };
    case "REPORT_PASTED":
      return {
        title: "Customer pasted a report",
        detail: "Manual paste fallback used.",
        dot: "bg-amber-500",
      };
    default:
      return {
        title: r.action.replace(/_/g, " ").toLowerCase(),
        detail: "",
        dot: "bg-fg-subtle/60",
      };
  }
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
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
