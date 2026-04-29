"use client";

import { useEffect, useState } from "react";

// Step 3 — AI Analysis Progress.
//
// Animated checklist that progresses on a soft schedule while the
// orchestrator polls the status API. Visual only — actual import work
// already happened in the relay/import API. This card communicates
// progress + builds confidence while the next poll lands.

const STAGES = [
  { id: "pull", label: "Pulling your tri-merge report" },
  { id: "parse", label: "Parsing tradelines and accounts" },
  { id: "negatives", label: "Detecting negative items and errors" },
  { id: "strategy", label: "Generating your dispute strategy" },
  { id: "letters", label: "Preparing your dispute letters" },
] as const;

type StageId = (typeof STAGES)[number]["id"];

export function StepAnalyze({
  imported,
  onDone,
}: {
  /**
   * `true` if the snapshot API has confirmed the import is fully
   * normalized. We auto-advance after a brief celebration delay so the
   * user perceives the AI animation completing before results render.
   */
  imported: boolean;
  onDone: () => void;
}) {
  const [active, setActive] = useState<StageId>("pull");
  const [completed, setCompleted] = useState<Set<StageId>>(new Set());

  useEffect(() => {
    // Run a soft progression — each stage takes ~1.6s. If the import
    // finishes before the animation does, we fast-forward through the
    // remaining stages and trigger onDone.
    let cancelled = false;
    let i = 0;
    const tick = async () => {
      while (!cancelled && i < STAGES.length) {
        const stage = STAGES[i];
        setActive(stage.id);
        await sleep(imported ? 350 : 1600);
        if (cancelled) return;
        setCompleted((prev) => {
          const next = new Set(prev);
          next.add(stage.id);
          return next;
        });
        i += 1;
      }
      if (!cancelled && imported) {
        await sleep(700);
        if (!cancelled) onDone();
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [imported, onDone]);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">
          Step 3 of 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Analyzing your report
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-fg-muted">
          Our AI is reading your tri-merge file, identifying violations, and
          drafting your strategy. This usually takes under a minute.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-border">
        <div className="relative bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-1">
          <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
          <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-surface px-7 py-8 sm:px-10 sm:py-10">
            <ul className="space-y-3">
              {STAGES.map((s) => {
                const isComplete = completed.has(s.id);
                const isActive = !isComplete && s.id === active;
                return (
                  <li
                    key={s.id}
                    className={[
                      "flex items-center gap-4 rounded-2xl border p-4 transition",
                      isComplete
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                        : isActive
                          ? "border-violet-300 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10"
                          : "border-border bg-surface",
                    ].join(" ")}
                  >
                    <StageIcon active={isActive} complete={isComplete} />
                    <div className="flex-1">
                      <div
                        className={[
                          "text-sm font-semibold",
                          isComplete
                            ? "text-emerald-700 dark:text-emerald-300"
                            : isActive
                              ? "text-fg"
                              : "text-fg-subtle",
                        ].join(" ")}
                      >
                        {s.label}
                      </div>
                      {isActive && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/20">
                          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-violet-500 to-indigo-500" />
                        </div>
                      )}
                    </div>
                    {isComplete && (
                      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                        Done
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                        Working
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 grid gap-3 rounded-2xl bg-surface-muted p-4 sm:grid-cols-3">
              <Insight label="Tradelines scanned" hint="updating live" />
              <Insight label="Negative items flagged" hint="weighted by impact" />
              <Insight label="Dispute opportunities" hint="ranked by confidence" />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-fg-subtle">
        You don&apos;t need to do anything — this happens automatically once
        your report lands.
      </p>
    </section>
  );
}

function Insight({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-fg">…</span>
        <span className="text-[11px] text-fg-subtle">{hint}</span>
      </div>
    </div>
  );
}

function StageIcon({ active, complete }: { active: boolean; complete: boolean }) {
  if (complete) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.7)]">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <path
            d="M3 8.5l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (active) {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
        aria-label="Working"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" fill="none">
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.3"
          />
          <path
            d="M14 8a6 6 0 00-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-fg-subtle ring-1 ring-border">
      <span className="h-2 w-2 rounded-full bg-fg-subtle/40" />
    </span>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
