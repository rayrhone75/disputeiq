"use client";

import { useMemo } from "react";
import {
  deriveHealthSignals,
  type HealthSignal,
} from "@/lib/admin/health";
import type {
  CustomerConsole,
  CustomerFollowUp,
  CustomerThread,
  TimelineRow,
} from "./types";

// Customer 360 health-signals panel.
//
// Derives signals from the data the orchestrator already fetched. No
// extra round-trip. Each signal renders as a compact row with a short
// label, reason, and a "Schedule follow-up" quick-action that the
// admin can use to open SupportCenter's follow-up composer pre-filled.

const STALE_THREAD_MS = 24 * 60 * 60 * 1000;

export function HealthSignals({
  console: c,
  threads,
  timeline,
  followUps,
}: {
  console: CustomerConsole;
  threads: CustomerThread[];
  timeline: TimelineRow[];
  followUps: CustomerFollowUp[];
}) {
  const signals = useMemo<HealthSignal[]>(() => {
    const now = Date.now();
    const subscription = c.subscription;
    const latestImport = c.creditImports.sort(
      (a, b) => b.createdAt - a.createdAt,
    )[0];
    const lastActivityAt =
      timeline.length > 0
        ? Math.max(...timeline.map((t) => t.createdAt))
        : null;
    const staleAdminUnreadThreads = threads.filter(
      (t) =>
        t.status === "open" &&
        t.unreadForAdmin &&
        t.lastMessageAt <= now - STALE_THREAD_MS,
    ).length;
    return deriveHealthSignals({
      user: {
        _id: c.user._id,
        email: c.user.email,
        createdAt: c.user.createdAt,
        isVip: !!c.user.isVip,
        archivedAt: c.user.archivedAt ?? null,
      },
      hasProfile: !!c.profile,
      hasActiveSubscription:
        !!subscription && subscription.status === "active",
      subscriptionStatus: subscription?.status ?? null,
      importsCount: c.creditImports.length,
      latestImportStatus: latestImport?.status ?? null,
      disputesStarted: c.disputes.length,
      lastActivityAt,
      staleAdminUnreadThreads,
      nowMs: now,
    });
  }, [c, threads, timeline]);

  if (signals.length === 0) {
    return (
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-6">
        <Header pendingFollowUps={pendingCount(followUps)} />
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-emerald-50/40 p-5 text-center dark:bg-emerald-500/10">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            All clear
          </p>
          <p className="mt-1 text-[12px] text-fg-muted">
            No health signals firing for this customer.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-6">
      <Header pendingFollowUps={pendingCount(followUps)} />

      <ul className="mt-4 space-y-2.5">
        {signals.map((s) => (
          <li
            key={s.key}
            className={[
              "flex items-start gap-3 rounded-2xl border p-3.5",
              tone(s.severity).panel,
            ].join(" ")}
          >
            <span
              className={[
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                tone(s.severity).iconBg,
              ].join(" ")}
            >
              <span className={`h-2 w-2 rounded-full ${tone(s.severity).dot}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">{s.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone(s.severity).pill}`}
                >
                  {s.severity}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-5 text-fg-muted">
                {s.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-5 text-fg-subtle">
        Use the Support Center below to log a note or schedule a follow-up.
      </p>
    </section>
  );
}

function Header({ pendingFollowUps }: { pendingFollowUps: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          Customer success
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
          Health signals
        </h3>
      </div>
      {pendingFollowUps > 0 && (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
          {pendingFollowUps} follow-up
          {pendingFollowUps === 1 ? "" : "s"} pending
        </span>
      )}
    </div>
  );
}

function pendingCount(followUps: CustomerFollowUp[]): number {
  return followUps.filter((f) => f.status === "pending").length;
}

function tone(severity: HealthSignal["severity"]) {
  if (severity === "alert") {
    return {
      panel:
        "border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/10",
      iconBg: "bg-rose-100 dark:bg-rose-500/20",
      dot: "bg-rose-500",
      pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    };
  }
  if (severity === "warn") {
    return {
      panel:
        "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10",
      iconBg: "bg-amber-100 dark:bg-amber-500/20",
      dot: "bg-amber-500",
      pill:
        "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    };
  }
  return {
    panel:
      "border-sky-200 bg-sky-50/40 dark:border-sky-500/30 dark:bg-sky-500/10",
    iconBg: "bg-sky-100 dark:bg-sky-500/20",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  };
}
