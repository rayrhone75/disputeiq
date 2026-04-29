"use client";

// Top-of-page progress indicator for the get-report onboarding.
// Five-step horizontal flow with connectors. Active step gets the
// gradient pill; completed steps get the emerald checkmark.

export type StepKey =
  | "provider"
  | "connect"
  | "analyze"
  | "results"
  | "disputes";

const ORDER: { key: StepKey; label: string; sub: string }[] = [
  { key: "provider", label: "Provider", sub: "Choose source" },
  { key: "connect", label: "Connect", sub: "One-click" },
  { key: "analyze", label: "Analyze", sub: "AI scan" },
  { key: "results", label: "Results", sub: "Your file" },
  { key: "disputes", label: "Disputes", sub: "Take action" },
];

function indexFor(step: StepKey): number {
  return ORDER.findIndex((s) => s.key === step);
}

export function Stepper({ current }: { current: StepKey }) {
  const currentIdx = indexFor(current);
  return (
    <nav
      aria-label="Get-report progress"
      className="relative mx-auto w-full max-w-5xl"
    >
      <ol className="flex items-center justify-between gap-2 sm:gap-4">
        {ORDER.map((s, i) => {
          const state =
            i < currentIdx ? "complete" : i === currentIdx ? "current" : "upcoming";
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition sm:h-10 sm:w-10",
                    state === "complete"
                      ? "bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.7)]"
                      : state === "current"
                        ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)] ring-4 ring-violet-200/60 dark:ring-violet-500/20"
                        : "bg-surface-muted text-fg-subtle",
                  ].join(" ")}
                >
                  {state === "complete" ? (
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
                <div className="hidden text-center sm:block">
                  <div
                    className={[
                      "text-[11px] font-semibold uppercase tracking-[0.18em]",
                      state === "current"
                        ? "text-fg"
                        : state === "complete"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-fg-subtle",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-fg-subtle">{s.sub}</div>
                </div>
              </div>
              {i < ORDER.length - 1 && (
                <div
                  className={[
                    "h-px flex-1 transition",
                    i < currentIdx
                      ? "bg-emerald-400/70"
                      : i === currentIdx
                        ? "bg-gradient-to-r from-violet-400/70 to-violet-200/30 dark:to-violet-700/30"
                        : "bg-border",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 text-center sm:hidden">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg">
          {ORDER[currentIdx]?.label}
        </div>
        <div className="text-[10px] text-fg-subtle">
          Step {currentIdx + 1} of {ORDER.length} · {ORDER[currentIdx]?.sub}
        </div>
      </div>
    </nav>
  );
}
