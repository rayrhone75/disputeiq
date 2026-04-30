"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toast";

// Modal that surfaces a one-time magic-link from an admin action.
// The admin copies the link and emails/SMSes it to the customer
// through their existing support channel.

export function LinkResultModal({
  title,
  description,
  url,
  expiresInSeconds,
  warning,
  onClose,
}: {
  title: string;
  description: string;
  url: string;
  expiresInSeconds?: number;
  warning?: string | null;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      push("success", "Link copied", "Paste it into your support channel.");
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      push("error", "Couldn't copy", (err as Error).message);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-[0_40px_100px_-30px_rgba(15,23,42,0.7)]">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Admin action
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full bg-white/15 p-1.5 text-white/90 ring-1 ring-white/30 hover:bg-white/25"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-sm leading-6 text-fg-muted">{description}</p>

          <div className="mt-4 rounded-2xl border border-border bg-surface-muted/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              Single-use link
            </div>
            <div className="mt-1 break-all font-mono text-[11px] leading-5 text-fg">
              {url}
            </div>
          </div>

          {warning && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {warning}
            </p>
          )}

          {typeof expiresInSeconds === "number" && (
            <p className="mt-2 text-[11px] text-fg-subtle">
              Expires in {humanDuration(expiresInSeconds)}.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function humanDuration(s: number): string {
  if (s >= 86400) return `${Math.round(s / 86400)} day${s >= 172800 ? "s" : ""}`;
  if (s >= 3600) return `${Math.round(s / 3600)} hour${s >= 7200 ? "s" : ""}`;
  if (s >= 60) return `${Math.round(s / 60)} minute${s >= 120 ? "s" : ""}`;
  return `${s} seconds`;
}
