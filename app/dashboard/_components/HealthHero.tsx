"use client";

import type { Aggregates, CreditReportStatusKind } from "./types";

// Section A — Credit Health hero.
//
// Premium "score-style" hero: large repair-progress ring (0–100%), a
// headline that summarizes the file in plain English, and three bureau
// chips. Built honestly from data we own — no fake FICO score, no
// placeholder digits. Customers get the visual affordance they expect
// without us inventing data we don't have.

const BUREAUS = ["EXPERIAN", "EQUIFAX", "TRANSUNION"] as const;
const BUREAU_LABEL: Record<(typeof BUREAUS)[number], string> = {
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
  TRANSUNION: "TransUnion",
};

export function HealthHero({
  agg,
  statusKind,
  greeting,
}: {
  agg: Aggregates;
  statusKind: CreditReportStatusKind;
  greeting: string;
}) {
  const headline = pickHeadline(agg, statusKind);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-1 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_60%)]" />
      <div className="relative rounded-[calc(theme(borderRadius.3xl)-4px)] bg-canvas-app/95 backdrop-blur-sm">
        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[auto_1fr] lg:items-center lg:p-10">
          {/* Progress ring */}
          <div className="flex items-center justify-center">
            <ProgressRing value={agg.repairProgress} />
          </div>

          {/* Headline + bureau chips */}
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">
                {greeting}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                {headline.title}
              </h1>
              <p className="mt-2 max-w-xl text-base leading-7 text-fg-muted">
                {headline.body}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {BUREAUS.map((b) => {
                const detected = agg.bureausDetected.has(b);
                return (
                  <span
                    key={b}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
                      detected
                        ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-300/60 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
                        : "bg-surface-muted text-fg-subtle ring-1 ring-border",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        detected ? "bg-emerald-500" : "bg-fg-subtle/40",
                      ].join(" ")}
                    />
                    {BUREAU_LABEL[b]}
                    {detected && (
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-300/80">
                        on file
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-border pt-5">
              <Mini label="Total items" value={agg.totalItems} />
              <Mini label="Removed" value={agg.removed} accent="emerald" />
              <Mini label="Remaining" value={agg.remaining} accent="rose" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 78;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative h-48 w-48 sm:h-52 sm:w-52">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={r}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="14"
          fill="none"
          className="text-fg"
        />
        <circle
          cx="100"
          cy="100"
          r={r}
          stroke="url(#ring-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
          Credit health
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-5xl font-semibold tracking-tight text-fg">
            {pct}
          </span>
          <span className="text-2xl font-semibold text-fg-muted">%</span>
        </div>
        <div className="mt-1 text-[11px] text-fg-subtle">repair progress</div>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "rose";
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : accent === "rose"
        ? "text-rose-600 dark:text-rose-300"
        : "text-fg";
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function pickHeadline(
  agg: Aggregates,
  status: CreditReportStatusKind,
): { title: string; body: string } {
  if (status === "not_started") {
    return {
      title: "Let's pull your report",
      body: "Connect your tri-merge file in under a minute. We'll analyze every tradeline, find inaccuracies, and prep your dispute strategy.",
    };
  }
  if (status === "in_progress" || status === "failed") {
    return {
      title: "Your file is being prepared",
      body: "We're working on your report. Once it lands, your repair progress and dispute plan will populate automatically.",
    };
  }
  if (agg.totalItems === 0) {
    return {
      title: "No tradelines to analyze yet",
      body: "Your import succeeded but didn't include any tradelines. Try a fresh pull or upload a different report file.",
    };
  }
  if (agg.removed > 0) {
    return {
      title: `${agg.removed} ${agg.removed === 1 ? "deletion" : "deletions"} won so far`,
      body: `You're making real progress. ${agg.remaining} tradeline${agg.remaining === 1 ? "" : "s"} remaining to challenge. Keep your momentum going.`,
    };
  }
  if (agg.inDispute > 0) {
    return {
      title: `${agg.inDispute} ${agg.inDispute === 1 ? "dispute" : "disputes"} in flight`,
      body: "Your packets are out. We'll update repair progress the moment a bureau response lands.",
    };
  }
  return {
    title: "Your dispute plan is ready",
    body: `${agg.totalItems} tradelines analyzed. Choose what to challenge and we'll handle the letters, certified mail, and tracking.`,
  };
}
