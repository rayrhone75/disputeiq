"use client";

import { useEffect, useState } from "react";

// Step 1 — Choose Provider.
//
// Four large visual cards. Each carries a subtle gradient, soft shadow,
// and a hover lift. The Recommended provider gets a glowing badge.
// Selection persists in sessionStorage so refreshes don't reset state.

export type Provider = "identityiq" | "myscoreiq" | "privacyguard" | "manual";

const PROVIDERS: Array<{
  id: Provider;
  name: string;
  tagline: string;
  badge?: string;
  bullets: string[];
  pricing: string;
  cta: string;
  available: boolean;
  glyph: React.ReactNode;
  accent: string; // tailwind classes for the card's color theme
}> = [
  {
    id: "identityiq",
    name: "IdentityIQ",
    tagline: "Most trusted by credit-repair pros.",
    badge: "Recommended",
    bullets: [
      "3-bureau report + scores",
      "Daily updates",
      "Identity-theft monitoring",
    ],
    pricing: "$1 trial · From $24.99/mo",
    cta: "Choose IdentityIQ",
    available: true,
    accent:
      "from-violet-500/15 to-indigo-500/5 ring-violet-300/60 dark:from-violet-500/20 dark:to-indigo-500/10",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <path
          d="M12 3l8 3v6c0 4.4-3.4 8.4-8 9-4.6-.6-8-4.6-8-9V6l8-3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "myscoreiq",
    name: "MyScoreIQ",
    tagline: "Premium FICO scoring with full tri-merge.",
    bullets: [
      "FICO 8 & 9 scoring",
      "All three bureaus",
      "Daily credit monitoring",
    ],
    pricing: "From $19.99/mo",
    cta: "Choose MyScoreIQ",
    available: true,
    accent:
      "from-sky-500/15 to-blue-500/5 ring-sky-300/60 dark:from-sky-500/20 dark:to-blue-500/10",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <path
          d="M3 13l4-4 4 4 4-6 6 8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "privacyguard",
    name: "PrivacyGuard",
    tagline: "Identity protection with credit monitoring.",
    bullets: [
      "All three bureau reports",
      "Lost-wallet protection",
      "$1M ID-theft insurance",
    ],
    pricing: "From $19.99/mo",
    cta: "Coming soon",
    available: false,
    accent:
      "from-rose-500/10 to-amber-500/5 ring-rose-300/40 dark:from-rose-500/15 dark:to-amber-500/10",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <path
          d="M12 3l9 4v5c0 5-3.6 9.5-9 11-5.4-1.5-9-6-9-11V7l9-4z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "manual",
    name: "I have a file",
    tagline: "Already have a credit-report PDF or text? Upload it.",
    bullets: [
      "Drag-and-drop PDF",
      "Paste plain text",
      "JSON tri-merge supported",
    ],
    pricing: "Always free",
    cta: "Upload my report",
    available: true,
    accent:
      "from-emerald-500/15 to-teal-500/5 ring-emerald-300/60 dark:from-emerald-500/20 dark:to-teal-500/10",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <path
          d="M12 4v12m0-12l-4 4m4-4l4 4M5 18h14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const STORAGE_KEY = "diq.getReport.provider.v1";

export function loadStoredProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw && (PROVIDERS.find((p) => p.id === raw)?.available ?? false)) {
      return raw as Provider;
    }
  } catch {
    // ignore
  }
  return null;
}

export function StepProvider({
  onSelect,
}: {
  onSelect: (p: Provider) => void;
}) {
  const [hovered, setHovered] = useState<Provider | null>(null);
  // Hydration-safe: sessionStorage isn't read during render.
  useEffect(() => {
    // No-op: stored value is read by the parent before mounting this step.
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">
          Step 1 of 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Choose where to pull your credit report
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-fg-muted">
          DisputeIQ analyzes your tri-merge file from any of these trusted
          providers. Bank-level encryption. We never see your password.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PROVIDERS.map((p) => {
          const lifted = hovered === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => p.available && onSelect(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              disabled={!p.available}
              className={[
                "group relative flex flex-col text-left rounded-3xl bg-surface p-6 ring-1 ring-inset transition-all duration-200",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]",
                lifted && p.available ? "-translate-y-1" : "",
                p.available
                  ? "cursor-pointer ring-border hover:ring-fg/20"
                  : "cursor-not-allowed opacity-70 ring-border",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:opacity-80 before:transition-opacity",
                `before:${p.accent.split(" ").slice(0, 2).join(" ")}`,
              ].join(" ")}
            >
              <div
                className={`pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br opacity-60 ${p.accent}`}
                aria-hidden
              />
              <div className="relative flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div
                    className={[
                      "flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-fg shadow-sm ring-1 ring-border",
                      lifted && p.available ? "scale-105" : "",
                      "transition-transform duration-200",
                    ].join(" ")}
                  >
                    {p.glyph}
                  </div>
                  {p.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.7)]">
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                        <path d="M6 0l1.6 3.6L11.5 4l-3 2.7L9.4 11 6 9 2.6 11l.9-4.3L.5 4l3.9-.4L6 0z" />
                      </svg>
                      {p.badge}
                    </span>
                  )}
                  {!p.available && (
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                      Coming soon
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-fg">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-fg-muted">
                    {p.tagline}
                  </p>
                </div>

                <ul className="space-y-1.5 text-sm text-fg-muted">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                        fill="none"
                      >
                        <path
                          d="M3 8.5l3 3 7-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                    {p.pricing}
                  </div>
                  <div
                    className={[
                      "mt-3 inline-flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                      p.available
                        ? "bg-fg text-canvas group-hover:bg-fg/90"
                        : "bg-surface-muted text-fg-subtle",
                    ].join(" ")}
                  >
                    <span>{p.cta}</span>
                    {p.available && (
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                        <path
                          d="M7 5l5 5-5 5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <TrustRow />
    </section>
  );
}

export function persistProvider(p: Provider): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, p);
  } catch {
    // ignore
  }
}

export function clearStoredProvider(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function TrustRow() {
  return (
    <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor">
          <path d="M8 0a4 4 0 014 4v2h.5A1.5 1.5 0 0114 7.5v6A1.5 1.5 0 0112.5 15h-9A1.5 1.5 0 012 13.5v-6A1.5 1.5 0 013.5 6H4V4a4 4 0 014-4zm0 1.5A2.5 2.5 0 005.5 4v2h5V4A2.5 2.5 0 008 1.5z" />
        </svg>
        256-bit encryption
      </span>
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor">
          <path d="M8 1l6 2.6V8c0 4-2.6 6.6-6 7.4C4.6 14.6 2 12 2 8V3.6L8 1z" />
        </svg>
        We never store your password
      </span>
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor">
          <path d="M3.5 7l3.5 3.5L12.5 4 14 5.5l-7 7L2 7.5z" />
        </svg>
        Cancel anytime
      </span>
    </div>
  );
}
