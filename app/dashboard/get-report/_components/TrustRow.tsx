"use client";

// Trust row — three pills below the hero. Reinforces the "we never see
// your password" promise + signals legitimacy. Plain copy, no jargon.

const TRUST = [
  {
    label: "We never store your login",
    body: "Your MyScoreIQ password stays on MyScoreIQ. DisputeIQ never receives it.",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path d="M8 0a4 4 0 014 4v2h.5A1.5 1.5 0 0114 7.5v6A1.5 1.5 0 0112.5 15h-9A1.5 1.5 0 012 13.5v-6A1.5 1.5 0 013.5 6H4V4a4 4 0 014-4zm0 1.5A2.5 2.5 0 005.5 4v2h5V4A2.5 2.5 0 008 1.5z" />
      </svg>
    ),
  },
  {
    label: "Secure encrypted import",
    body: "Reports are encrypted in transit and at rest. SOC-aligned hosting.",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path d="M8 1l6 2.6V8c0 4-2.6 6.6-6 7.4C4.6 14.6 2 12 2 8V3.6L8 1z" />
      </svg>
    ),
  },
  {
    label: "Cancel anytime",
    body: "No lock-in. Export your file or pause your subscription whenever.",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path d="M3.5 7l3.5 3.5L12.5 4 14 5.5l-7 7L2 7.5z" />
      </svg>
    ),
  },
];

export function TrustRow() {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {TRUST.map((t) => (
        <div
          key={t.label}
          className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            {t.icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-fg">{t.label}</div>
            <div className="mt-0.5 text-[12px] leading-5 text-fg-muted">
              {t.body}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
