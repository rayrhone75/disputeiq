"use client";

import {
  deriveAdvisorSuggestions,
  type AdvisorSuggestion,
} from "@/lib/dashboard/advisor";
import type { Aggregates, CustomerConsole } from "./types";

// Admin parity view — "What the customer sees in their advisor".
//
// Runs the exact same rules the customer's StatsAndAdvisor uses,
// fed by data the Customer 360 already loaded. No new endpoints, no
// impersonation. Lets support read the customer's recommended next
// step without picking up the phone.

const TONE: Record<
  AdvisorSuggestion["tone"],
  { panel: string; pill: string }
> = {
  violet: {
    panel:
      "border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/10",
    pill:
      "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  },
  indigo: {
    panel:
      "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10",
    pill:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  emerald: {
    panel:
      "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    pill:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  sky: {
    panel:
      "border-sky-200 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-500/10",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  },
  amber: {
    panel:
      "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10",
    pill:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  },
  rose: {
    panel:
      "border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/10",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  },
};

export function CustomerAdvisorView({
  console: c,
  agg,
}: {
  console: CustomerConsole;
  agg: Aggregates;
}) {
  // Derive the same inputs StatsAndAdvisor receives from
  // dashboardOverview, but from customer-console data we already have.
  const hasProfile = !!c.profile;
  const hasSubscription =
    !!c.subscription && c.subscription.status === "active";
  const latestImport = c.creditImports
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const reportKind: "not_started" | "in_progress" | "imported" | "failed" = !latestImport
    ? "not_started"
    : latestImport.status === "NORMALIZED"
      ? "imported"
      : latestImport.status === "FAILED"
        ? "failed"
        : "in_progress";
  // We don't have packetUsage on the customer-console payload, but we
  // can derive a reasonable approximation: subscriptions carry
  // includedPackets, and disputesSent/inFlight is in agg. The customer
  // dashboard's actual remaining count is gated on cycleStart, which
  // we don't have here — so admins see "0 if at limit" only when
  // disputesSent ≥ includedPackets. Close enough for parity.
  const included = c.subscription?.includedPackets ?? 0;
  const remaining = Math.max(0, included - agg.disputesSent);

  const suggestions = deriveAdvisorSuggestions(
    {
      onboarding: { hasProfile, hasSubscription },
      creditReportStatus: { kind: reportKind },
      packetUsage: {
        plan: c.subscription?.planCode ?? null,
        remaining,
      },
      user: { billingOverride: c.user.billingOverride ?? null },
    },
    {
      totalItems: agg.totalTradelines,
      removed: agg.deletions,
      inDispute: agg.disputesInFlight,
      draftReady: agg.draftReady,
      responseReceived: agg.responseReceived,
      escalationReady: agg.escalationReady,
      collections: agg.totalNegatives,
    },
  );

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Advisor preview
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            What the customer sees
          </h3>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
          Same rules as their dashboard
        </span>
      </div>

      {suggestions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-emerald-50/30 p-5 text-center dark:bg-emerald-500/10">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            All clear
          </p>
          <p className="mt-1 text-[12px] text-fg-muted">
            Advisor has no actionable suggestions right now.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {suggestions.map((s) => (
            <li
              key={s.key}
              className={`rounded-2xl border p-3.5 ${TONE[s.tone].panel}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${TONE[s.tone].pill}`}
                >
                  {s.key.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-semibold text-fg">{s.title}</span>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                {s.body}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle">
                Customer CTA → <code className="rounded bg-surface px-1 py-0.5 font-mono">{s.href}</code>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
