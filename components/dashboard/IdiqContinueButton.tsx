"use client";

// Premium CTA for the MyScoreIQ activation step. Tracks the click
// client-side so we can surface "opened MyScoreIQ but didn't return" on the
// support console. The click is recorded under the legacy `IDIQ_CLICK`
// audit action — the action name is an internal identifier and renaming it
// would require backfilling existing audit rows. Customer-facing copy is
// MyScoreIQ.
export function IdiqContinueButton({
  href,
  label = "Activate MyScoreIQ",
}: {
  href: string;
  label?: string;
}) {
  function onClick() {
    // Fire-and-forget — we don't block the redirect if telemetry fails.
    fetch("/api/idiq/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-6 py-3 text-sm font-semibold text-canvas shadow-[0_18px_48px_-18px_rgba(79,70,229,0.6)] transition hover:-translate-y-0.5 hover:bg-fg/90"
    >
      {label}
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        className="text-canvas/80"
      >
        <path
          d="M7 5l5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
