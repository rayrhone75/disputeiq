"use client";

import Link from "next/link";
import type { DashboardOverview } from "./types";

// Section E — Recent activity feed.
//
// Combined timeline of dispute events and certified-mail events. Sorted
// newest first, capped at 8 entries. Pretty, scannable, no actions.

type Entry = {
  id: string;
  ts: number;
  kind: "dispute" | "mail";
  title: string;
  detail: string;
  status: string;
};

export function RecentActivity({ overview }: { overview: DashboardOverview }) {
  const entries = buildEntries(overview);

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            Activity
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Recent updates
          </h3>
        </div>
        <Link
          href="/dashboard/disputes"
          className="text-xs font-semibold text-fg-muted hover:text-fg"
        >
          View all →
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface-muted/60 p-6 text-center">
          <p className="text-sm text-fg-muted">
            No activity yet. Once you start your first round, every dispute
            event and certified-mail update will land here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              <span
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  e.kind === "mail"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                    : "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
                ].join(" ")}
              >
                {e.kind === "mail" ? <IconMail /> : <IconDispute />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{e.title}</span>
                  <StatusPill status={e.status} kind={e.kind} />
                </div>
                <div className="mt-0.5 text-[12px] leading-5 text-fg-muted">
                  {e.detail}
                </div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-fg-subtle">
                {formatRelative(e.ts)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({
  status,
  kind,
}: {
  status: string;
  kind: "dispute" | "mail";
}) {
  const label = status.replace(/_/g, " ").toLowerCase();
  const tone = pillTone(status, kind);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}
    >
      {label}
    </span>
  );
}

function pillTone(status: string, kind: "dispute" | "mail"): string {
  if (status === "CLOSED" || status === "DELIVERED") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }
  if (status === "RESPONSE_RECEIVED") {
    return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
  }
  if (status === "ESCALATION_READY") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }
  if (status === "MAILED" || status === "PAID") {
    return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200";
  }
  if (status === "DRAFT" || status === "READY_FOR_PAYMENT") {
    return "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200";
  }
  return kind === "mail"
    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
    : "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200";
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

function buildEntries(o: DashboardOverview): Entry[] {
  const out: Entry[] = [];
  for (const d of o.disputes) {
    const ts =
      typeof d.mailedAt === "number" && d.mailedAt
        ? d.mailedAt
        : 0;
    if (!ts) continue;
    out.push({
      id: `d:${d._id}`,
      ts,
      kind: "dispute",
      title: d.tradeline?.creditorName ?? "Dispute packet",
      detail: d.aiReasonSummary ?? "Packet created and queued for mailing.",
      status: d.status,
    });
  }
  for (const m of o.mailJobs) {
    const ts =
      (typeof m.deliveredAt === "number" && m.deliveredAt) ||
      m.createdAt;
    out.push({
      id: `m:${m._id}`,
      ts,
      kind: "mail",
      title: m.providerJobId
        ? `Certified mail · ${m.providerJobId}`
        : "Certified mail",
      detail: m.trackingCode
        ? `Tracking ${m.trackingCode}`
        : "Awaiting tracking number from carrier",
      status: m.status,
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, 8);
}

function IconMail() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <rect
        x="2"
        y="4"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M2 5l6 4 6-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconDispute() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M3 3h7l3 3v7H3V3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 3v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 9h6M5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
