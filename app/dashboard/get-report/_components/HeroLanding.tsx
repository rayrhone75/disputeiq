"use client";

// Hero landing for /dashboard/get-report.
//
// Single primary CTA — "Connect MyScoreIQ" — that opens the
// ConnectModal. No 5-step provider selection. No technical language.
// Customer scans the page and immediately knows what to do.

export function HeroLanding({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-1 shadow-[0_40px_100px_-30px_rgba(99,102,241,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_60%)]" />
      <div className="relative rounded-[calc(theme(borderRadius.3xl)-4px)] bg-canvas-app/95 backdrop-blur-sm">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:p-12">
          {/* Headline + CTA */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-300">
              Step 1 · Connect your report
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl lg:text-[2.6rem] lg:leading-[1.1]">
              Import your credit report
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-fg-muted sm:text-lg">
              Connect your credit report in seconds. No hassle.
            </p>

            <button
              type="button"
              onClick={onConnect}
              className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-fg px-7 py-4 text-base font-semibold text-canvas shadow-[0_24px_60px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:opacity-95 sm:w-auto"
            >
              <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
                <path
                  d="M9 2.5l5 2.6V9c0 3.5-2.3 5.9-5 6.5-2.7-.6-5-3-5-6.5V5.1l5-2.6z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.5 9l1.7 1.7L12 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Connect MyScoreIQ
            </button>
            <p className="mt-3 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3 text-emerald-500"
                  fill="currentColor"
                >
                  <path d="M6 0l1.6 3.6L11.5 4l-3 2.7L9.4 11 6 9 2.6 11l.9-4.3L.5 4l3.9-.4L6 0z" />
                </svg>
                We never see or store your MyScoreIQ password.
              </span>
            </p>
          </div>

          {/* Right-side visual: stylized "card" preview */}
          <div className="hidden lg:block">
            <PreviewCard />
          </div>
        </div>

        {/* What happens next mini-row */}
        <div className="border-t border-border bg-surface-muted/40 px-8 py-5 sm:px-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tip
              n="1"
              title="Open"
              body="We open MyScoreIQ in a new tab."
            />
            <Tip
              n="2"
              title="Sign in"
              body="You sign in there — your password never touches DisputeIQ."
            />
            <Tip
              n="3"
              title="Done"
              body="Our Secure Connector handles the import automatically."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Tip({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-fg">{title}</div>
        <div className="text-[12px] leading-5 text-fg-muted">{body}</div>
      </div>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl" />
      <div className="relative rounded-2xl bg-surface p-5 shadow-[0_30px_60px_-25px_rgba(15,23,42,0.45)] ring-1 ring-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600" />
            <div>
              <div className="text-xs font-semibold text-fg">MyScoreIQ</div>
              <div className="text-[10px] text-fg-subtle">Tri-merge report</div>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
            Connecting
          </span>
        </div>
        <div className="mt-4 space-y-2.5">
          <RowLine label="Tradelines" valueWidth="w-12" />
          <RowLine label="Inquiries" valueWidth="w-8" />
          <RowLine label="Collections" valueWidth="w-10" />
          <RowLine label="Bureaus" valueWidth="w-16" />
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/20">
          <div className="h-full w-2/3 animate-pulse bg-gradient-to-r from-violet-500 to-indigo-500" />
        </div>
      </div>
    </div>
  );
}

function RowLine({ label, valueWidth }: { label: string; valueWidth: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className={`h-2 rounded-full bg-fg/10 ${valueWidth}`} />
    </div>
  );
}
