"use client";

import Link from "next/link";
import type { CreditReportSnapshot } from "@/app/api/credit-report/snapshot/route";

// Step 4 — Results dashboard.
// Step 5 — Big green "Start My Disputes" CTA.
//
// Renders a stat grid summarizing the user's file plus a bureau-coverage
// row and tradeline-overview pill list. No raw report data is exposed —
// only headline counts. The big CTA is the natural next action.
//
// Empty-snapshot recovery: when all counts are zero (the customer's last
// upload didn't actually extract anything — most often a saved HTML page
// from MyScoreIQ that's empty after JS-rendered content is stripped, or
// an image-only PDF), we render a recovery card instead of the zeros
// dashboard. The card explains what happened and points the customer at
// /dashboard/get-report so they can re-upload, with the JSON download
// flagged as the most reliable option.

const BUREAUS = ["EXPERIAN", "EQUIFAX", "TRANSUNION"] as const;
type Bureau = (typeof BUREAUS)[number];

const BUREAU_LABEL: Record<Bureau, string> = {
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
  TRANSUNION: "TransUnion",
};

function isEmptySnapshot(s: CreditReportSnapshot): boolean {
  return (
    s.tradelineCount === 0 &&
    s.collectionCount === 0 &&
    s.publicRecordCount === 0 &&
    s.inquiryCount === 0 &&
    s.candidateCount === 0
  );
}

export function StepResults({
  snapshot,
}: {
  snapshot: CreditReportSnapshot;
}) {
  if (isEmptySnapshot(snapshot)) {
    return <EmptyResultsRecovery />;
  }

  const detected = new Set(snapshot.bureausDetected);
  const remainingNegatives = Math.max(0, snapshot.negativeCount);
  const importedAt = snapshot.importedAt
    ? new Date(snapshot.importedAt).toLocaleString()
    : null;

  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-8 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
          Step 4 of 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Your credit file is ready
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-fg-muted">
          We found {snapshot.candidateCount} dispute opportunit
          {snapshot.candidateCount === 1 ? "y" : "ies"} across{" "}
          {snapshot.tradelineCount} tradelines. Review your plan below, then
          launch your first round.
        </p>
        {importedAt && (
          <p className="mt-2 text-xs text-fg-subtle">Imported {importedAt}</p>
        )}
      </header>

      {/* Headline stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Deleted"
          value={0}
          tone="emerald"
          hint="Items removed from your reports"
        />
        <Stat
          label="In dispute"
          value={0}
          tone="indigo"
          hint="Letters in flight"
        />
        <Stat
          label="Remaining negatives"
          value={remainingNegatives}
          tone={remainingNegatives === 0 ? "emerald" : "rose"}
          hint="Things to challenge"
        />
        <Stat
          label="Updated"
          value={0}
          tone="sky"
          hint="Bureau accepted change"
        />
        <Stat
          label="Verified"
          value={0}
          tone="amber"
          hint="Bureau confirmed item"
        />
        <Stat
          label="Repair progress"
          value="0%"
          tone="violet"
          hint="Toward your clean-file goal"
        />
      </div>

      {/* Bureau scores + tradeline overview */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-fg">Bureau coverage</h3>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
              From your latest pull
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {BUREAUS.map((b) => {
              const present = detected.has(b);
              return (
                <div
                  key={b}
                  className={[
                    "rounded-2xl p-4 ring-1 transition",
                    present
                      ? "bg-gradient-to-br from-emerald-50 to-surface ring-emerald-200 dark:from-emerald-500/15 dark:to-surface dark:ring-emerald-500/30"
                      : "bg-surface-muted ring-border",
                  ].join(" ")}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                    {BUREAU_LABEL[b]}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={[
                        "text-3xl font-semibold tracking-tight",
                        present ? "text-fg" : "text-fg-subtle",
                      ].join(" ")}
                    >
                      {present ? "On file" : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {present
                      ? "Tradelines & inquiries detected."
                      : "Not present in this pull."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-fg">
              Tradeline overview
            </h3>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
              {snapshot.tradelineCount} total
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <Row
              icon="account"
              label="Open & current"
              value={Math.max(
                0,
                snapshot.tradelineCount - snapshot.collectionCount,
              )}
              hint="No action needed"
              tone="emerald"
            />
            <Row
              icon="warn"
              label="Collections"
              value={snapshot.collectionCount}
              hint="High dispute priority"
              tone="rose"
            />
            <Row
              icon="public"
              label="Public records"
              value={snapshot.publicRecordCount}
              hint="Bankruptcies, liens, judgments"
              tone="amber"
            />
            <Row
              icon="search"
              label="Hard inquiries"
              value={snapshot.inquiryCount}
              hint="Recent credit pulls"
              tone="indigo"
            />
          </div>
        </div>
      </div>

      {/* Step 5 — Big Green CTA */}
      <div className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-1 shadow-[0_30px_80px_-20px_rgba(16,185,129,0.55)]">
        <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-emerald-50/80 px-7 py-8 dark:bg-emerald-950/40 sm:px-10 sm:py-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
                Step 5 of 5
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-3xl">
                Ready to challenge {snapshot.candidateCount}{" "}
                {snapshot.candidateCount === 1 ? "item" : "items"}?
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">
                We&apos;ll generate the letters, queue the certified mail, and
                track every bureau response. You stay in control — approve
                each round before anything sends.
              </p>
            </div>
            <Link
              href="/dashboard/disputes"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-4 text-base font-semibold text-white shadow-[0_18px_48px_-12px_rgba(5,150,105,0.55)] transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Start My Disputes
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                <path
                  d="M7 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyResultsRecovery() {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="rounded-3xl border-2 border-amber-300 bg-amber-50/70 p-8 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.35)] dark:border-amber-500/30 dark:bg-amber-500/10 sm:p-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
              <path
                d="M12 9v4m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
              Couldn&apos;t read your report
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              We didn&apos;t find any tradelines in your last upload.
            </h1>
            <p className="mt-3 text-sm leading-6 text-fg-muted sm:text-base">
              That usually means the file was a saved HTML page (MyScoreIQ
              renders with JavaScript, so the saved HTML is often empty)
              or an image-only PDF. The most reliable fix is to print
              your report to PDF — that captures whatever you see on
              screen, regardless of how MyScoreIQ delivers it.
            </p>

            <div className="mt-6 grid gap-3 rounded-2xl border border-amber-200/60 bg-white/40 p-4 text-[13px] leading-5 text-fg-muted dark:border-amber-500/20 dark:bg-surface/30">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Best option · Print → Save as PDF
              </p>
              <ol className="ml-4 list-decimal space-y-1.5">
                <li>Open your credit report in MyScoreIQ.</li>
                <li>
                  Press{" "}
                  <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                    Ctrl+P
                  </kbd>{" "}
                  (or{" "}
                  <kbd className="rounded border border-border bg-surface px-1 font-mono text-[11px]">
                    ⌘+P
                  </kbd>
                  ) to open the Print dialog.
                </li>
                <li>
                  Set <strong>Destination</strong> to{" "}
                  <strong>Save as PDF</strong> (Chrome/Edge) or pick a PDF
                  printer in Safari/Firefox.
                </li>
                <li>Click <strong>Save</strong> and pick a location on your computer.</li>
                <li>
                  Drop that PDF on the upload card on the next page —
                  it&apos;ll have all your tradelines, account history,
                  and inquiries.
                </li>
              </ol>
              <p className="mt-1 text-[11px] text-amber-900/70 dark:text-amber-200/70">
                Or paste the report text directly into the upload card
                (open the &ldquo;Paste text instead&rdquo; option) — works
                anytime you can see the report on screen.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/get-report"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-amber-700"
              >
                Try uploading again
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                  <path
                    d="M7 5l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-border-strong bg-surface px-5 py-3 text-sm font-semibold text-fg-muted hover:bg-surface-muted"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: "emerald" | "indigo" | "rose" | "sky" | "amber" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    emerald:
      "from-emerald-50 to-surface ring-emerald-200 dark:from-emerald-500/15 dark:to-surface dark:ring-emerald-500/30",
    indigo:
      "from-indigo-50 to-surface ring-indigo-200 dark:from-indigo-500/15 dark:to-surface dark:ring-indigo-500/30",
    rose: "from-rose-50 to-surface ring-rose-200 dark:from-rose-500/15 dark:to-surface dark:ring-rose-500/30",
    sky: "from-sky-50 to-surface ring-sky-200 dark:from-sky-500/15 dark:to-surface dark:ring-sky-500/30",
    amber:
      "from-amber-50 to-surface ring-amber-200 dark:from-amber-500/15 dark:to-surface dark:ring-amber-500/30",
    violet:
      "from-violet-50 to-surface ring-violet-200 dark:from-violet-500/15 dark:to-surface dark:ring-violet-500/30",
  };
  const tonesValue: Record<typeof tone, string> = {
    emerald: "text-emerald-700 dark:text-emerald-200",
    indigo: "text-indigo-700 dark:text-indigo-200",
    rose: "text-rose-700 dark:text-rose-200",
    sky: "text-sky-700 dark:text-sky-200",
    amber: "text-amber-700 dark:text-amber-200",
    violet: "text-violet-700 dark:text-violet-200",
  };
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br p-5 ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] ${tones[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${tonesValue[tone]}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-5 text-fg-muted">{hint}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: "account" | "warn" | "public" | "search";
  label: string;
  value: number;
  hint: string;
  tone: "emerald" | "rose" | "amber" | "indigo";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  };
  const glyphs: Record<typeof icon, React.ReactNode> = {
    account: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    warn: (
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
    ),
    public: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
        <path d="M2 13h12M3 13V7l5-3 5 3v6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5 13V9M11 13V9M8 13V9" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    search: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
        <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        {glyphs[icon]}
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-fg">{label}</div>
        <div className="text-[11px] text-fg-muted">{hint}</div>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-fg">{value}</div>
    </div>
  );
}
