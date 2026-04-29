"use client";

import Link from "next/link";
import type { Aggregates, DashboardOverview } from "./types";

// Section D — Stats + Advisor.
//
// Two columns: four stat tiles on the left, a rule-based advisor list
// on the right. Suggestions are deterministic — no LLM, no async work.
// Each is a clickable row that deep-links to the relevant page.

export function StatsAndAdvisor({
  overview,
  agg,
}: {
  overview: DashboardOverview;
  agg: Aggregates;
}) {
  const suggestions = buildSuggestions(overview, agg);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Stat
          label="Removed"
          value={agg.removed}
          hint="Deletions won"
          tone="emerald"
        />
        <Stat
          label="In dispute"
          value={agg.inDispute}
          hint="Letters in flight"
          tone="indigo"
        />
        <Stat
          label="Remaining"
          value={agg.remaining}
          hint="Not yet challenged"
          tone="amber"
        />
        <Stat
          label="Verified"
          value={agg.verified}
          hint="Accurate accounts"
          tone="sky"
        />
      </div>

      {/* Advisor */}
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
              DisputeIQ Advisor
            </p>
            <h3 className="mt-1 text-base font-semibold tracking-tight text-fg">
              What to do next
            </h3>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
            Personalized
          </span>
        </div>

        <ul className="mt-5 space-y-3">
          {suggestions.length === 0 ? (
            <li className="rounded-2xl border border-border bg-surface-muted/60 p-4 text-sm text-fg-muted">
              You&apos;re all caught up. The advisor will surface new
              recommendations the moment something needs your attention.
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li key={i}>
                <Link
                  href={s.href}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)]"
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_PILL[s.tone]}`}
                  >
                    {s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-fg">
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-5 text-fg-muted">
                      {s.body}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 20 20"
                    className="mt-1 h-4 w-4 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg"
                    fill="none"
                  >
                    <path
                      d="M7 5l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

const TONE_PILL: Record<
  "emerald" | "indigo" | "amber" | "rose" | "sky" | "violet",
  string
> = {
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
};

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "emerald" | "indigo" | "amber" | "sky";
}) {
  const accent: Record<typeof tone, string> = {
    emerald: "from-emerald-50 to-surface ring-emerald-200/70 dark:from-emerald-500/15 dark:to-surface dark:ring-emerald-500/30",
    indigo: "from-indigo-50 to-surface ring-indigo-200/70 dark:from-indigo-500/15 dark:to-surface dark:ring-indigo-500/30",
    amber: "from-amber-50 to-surface ring-amber-200/70 dark:from-amber-500/15 dark:to-surface dark:ring-amber-500/30",
    sky: "from-sky-50 to-surface ring-sky-200/70 dark:from-sky-500/15 dark:to-surface dark:ring-sky-500/30",
  };
  const valueColor: Record<typeof tone, string> = {
    emerald: "text-emerald-700 dark:text-emerald-200",
    indigo: "text-indigo-700 dark:text-indigo-200",
    amber: "text-amber-700 dark:text-amber-200",
    sky: "text-sky-700 dark:text-sky-200",
  };
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br p-5 ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] ${accent[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${valueColor[tone]}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-5 text-fg-muted">{hint}</div>
    </div>
  );
}

type Suggestion = {
  title: string;
  body: string;
  href: string;
  tone: "emerald" | "indigo" | "amber" | "rose" | "sky" | "violet";
  icon: React.ReactNode;
};

function buildSuggestions(o: DashboardOverview, agg: Aggregates): Suggestion[] {
  const out: Suggestion[] = [];

  if (!o.onboarding.hasProfile) {
    out.push({
      title: "Finish your profile",
      body: "Address and identity details unlock letter generation. Two minutes.",
      href: "/dashboard/onboarding",
      tone: "violet",
      icon: <IconUser />,
    });
  }
  if (!o.onboarding.hasSubscription) {
    out.push({
      title: "Choose a plan to start disputing",
      body: "Every plan includes monthly packets, certified mail, and bureau tracking.",
      href: "/dashboard/onboarding",
      tone: "indigo",
      icon: <IconCard />,
    });
  }
  if (
    o.creditReportStatus.kind === "not_started" ||
    o.creditReportStatus.kind === "failed"
  ) {
    out.push({
      title:
        o.creditReportStatus.kind === "failed"
          ? "Retry your report import"
          : "Connect your credit report",
      body: "We'll analyze every tradeline and surface dispute opportunities the moment it lands.",
      href: "/dashboard/get-report",
      tone: o.creditReportStatus.kind === "failed" ? "amber" : "violet",
      icon: <IconUpload />,
    });
  }
  if (agg.draftReady > 0) {
    out.push({
      title: `Approve ${agg.draftReady} ${agg.draftReady === 1 ? "letter" : "letters"} ready to mail`,
      body: "Review the draft, approve, and we'll send certified mail tomorrow morning.",
      href: "/dashboard/letters",
      tone: "emerald",
      icon: <IconSend />,
    });
  }
  if (agg.responseReceived > 0) {
    out.push({
      title: `Bureau ${agg.responseReceived === 1 ? "responded" : "responses received"}`,
      body: "Open the dispute timeline to see what they said and decide your next move.",
      href: "/dashboard/disputes",
      tone: "sky",
      icon: <IconInbox />,
    });
  }
  if (agg.escalationReady > 0) {
    out.push({
      title: `Escalate ${agg.escalationReady} stalled ${agg.escalationReady === 1 ? "item" : "items"}`,
      body: "These were delivered but not removed. Time for method-of-verification or CFPB pressure.",
      href: "/dashboard/disputes",
      tone: "rose",
      icon: <IconAlert />,
    });
  }
  if (
    o.onboarding.hasSubscription &&
    o.creditReportStatus.kind === "imported" &&
    agg.totalItems > 0 &&
    agg.inDispute === 0 &&
    agg.removed === 0 &&
    agg.draftReady === 0
  ) {
    out.push({
      title: "Pick your first dispute round",
      body: "Your file is analyzed and ranked. Approve a round to kick off your first packet.",
      href: "/dashboard/disputes",
      tone: "emerald",
      icon: <IconSparkle />,
    });
  }
  if (
    o.packetUsage.plan &&
    o.packetUsage.remaining === 0 &&
    agg.draftReady > 0
  ) {
    out.push({
      title: "You're at your monthly packet limit",
      body: `Upgrade your plan or pay-per-packet to send the ${agg.draftReady} drafted letters now.`,
      href: "/dashboard/settings",
      tone: "amber",
      icon: <IconCard />,
    });
  }

  return out.slice(0, 3);
}

function IconUser() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13.5C3.5 11 5.5 10 8 10s4.5 1 5.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconCard() {
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
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M8 3v8m0-8l-3 3m3-3l3 3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M14 2L2 7l5 2m7-7L9 14l-2-5m7-7L7 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M2 9l2-5h8l2 5v3.5A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5V9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M2 9h4l1 2h2l1-2h4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M8 2l6 11H2L8 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 7v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path
        d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4L8 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
