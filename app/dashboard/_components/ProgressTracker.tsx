"use client";

import type { DashboardOverview } from "./types";

// Section C — Dispute progress tracker.
//
// Six-stage timeline (Imported → Analyzed → Draft → Sent → Delivered →
// Completed). Same logic the legacy dashboard used; new visual treatment.
// Active stage gets a gradient pill; completed stages get an emerald
// checkmark; future stages stay quiet.

const STEPS: Array<{ key: string; label: string; sub: string }> = [
  { key: "imported", label: "Imported", sub: "Report on file" },
  { key: "analyzed", label: "Analyzed", sub: "AI reviewed" },
  { key: "draft", label: "Draft", sub: "Letters prepared" },
  { key: "sent", label: "Sent", sub: "Certified mail" },
  { key: "delivered", label: "Delivered", sub: "Bureau received" },
  { key: "completed", label: "Completed", sub: "Items removed" },
];

export function ProgressTracker({ overview }: { overview: DashboardOverview }) {
  const reached = computeReached(overview);
  const currentIdx = reached.findIndex((r) => !r);
  const activeIdx = currentIdx === -1 ? STEPS.length - 1 : currentIdx;

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-7">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-fg sm:text-lg">
          Dispute progress
        </h3>
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
          Stage {Math.min(activeIdx + 1, STEPS.length)} of {STEPS.length}
        </span>
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = reached[i];
          const isCurrent = !done && i === activeIdx;
          return (
            <li
              key={s.key}
              className="flex flex-col items-center text-center"
            >
              <div className="relative flex w-full items-center justify-center">
                {/* Connector lines */}
                {i > 0 && (
                  <span
                    className={[
                      "absolute right-1/2 top-5 hidden h-px w-full sm:block",
                      reached[i - 1]
                        ? "bg-emerald-400/70"
                        : i - 1 === activeIdx
                          ? "bg-gradient-to-r from-violet-300/50 to-violet-200/20 dark:to-violet-700/20"
                          : "bg-border",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
                {i < STEPS.length - 1 && (
                  <span
                    className={[
                      "absolute left-1/2 top-5 hidden h-px w-full sm:block",
                      reached[i]
                        ? "bg-emerald-400/70"
                        : i === activeIdx
                          ? "bg-gradient-to-r from-violet-300/50 to-violet-200/20 dark:to-violet-700/20"
                          : "bg-border",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
                <div
                  className={[
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition",
                    done
                      ? "bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.7)]"
                      : isCurrent
                        ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)] ring-4 ring-violet-200/60 dark:ring-violet-500/20"
                        : "bg-surface-muted text-fg-subtle ring-1 ring-border",
                  ].join(" ")}
                >
                  {done ? (
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                      <path
                        d="M3 8.5l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
              </div>
              <div className="mt-3">
                <div
                  className={[
                    "text-[11px] font-semibold uppercase tracking-[0.18em]",
                    done
                      ? "text-emerald-700 dark:text-emerald-300"
                      : isCurrent
                        ? "text-fg"
                        : "text-fg-subtle",
                  ].join(" ")}
                >
                  {s.label}
                </div>
                <div className="mt-0.5 hidden text-[10px] text-fg-subtle sm:block">
                  {s.sub}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function computeReached(o: DashboardOverview): boolean[] {
  const hasReport =
    o.creditReportStatus.kind === "imported" || o.reports.length > 0;
  const hasAnalysis = o.tradelines.length > 0;
  const hasDraft = o.disputes.some(
    (d) =>
      d.status === "DRAFT" ||
      d.status === "READY_FOR_PAYMENT" ||
      d.status === "PAID",
  );
  const hasSent = o.disputes.some(
    (d) =>
      d.status === "MAILED" ||
      d.status === "DELIVERED" ||
      d.status === "RESPONSE_RECEIVED" ||
      d.status === "CLOSED",
  );
  const hasDelivered = o.disputes.some(
    (d) =>
      d.status === "DELIVERED" ||
      d.status === "RESPONSE_RECEIVED" ||
      d.status === "CLOSED",
  );
  const hasCompleted = o.disputes.some((d) => d.status === "CLOSED");
  return [hasReport, hasAnalysis, hasDraft, hasSent, hasDelivered, hasCompleted];
}
