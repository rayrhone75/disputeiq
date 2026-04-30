"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Context-aware Help widget for the customer dashboard.
//
// Renders three short FAQ links plus a "Message support" inline form.
// Submitting the form creates a new thread and routes the customer to
// /dashboard/messages?threadId=… so they see their conversation
// immediately. No external chat infrastructure — uses the in-app
// messaging endpoints we just shipped.

type Context = "dashboard" | "get-report";

const TIPS: Record<Context, Array<{ q: string; href: string }>> = {
  dashboard: [
    {
      q: "What happens after I import my report?",
      href: "/learn/how-to-dispute-credit-report",
    },
    {
      q: "How do I send my first dispute letter?",
      href: "/dashboard/letters",
    },
    {
      q: "How do bureau responses get tracked?",
      href: "/dashboard/disputes",
    },
  ],
  "get-report": [
    {
      q: "How does the secure connector work?",
      href: "/dashboard/get-report",
    },
    {
      q: "What if MyScoreIQ asks me to log in again?",
      href: "/dashboard/get-report",
    },
    {
      q: "Can I upload my report instead?",
      href: "/dashboard/get-report",
    },
  ],
};

const SUBJECT: Record<Context, string> = {
  dashboard: "Help with my DisputeIQ dashboard",
  "get-report": "Help connecting my credit report",
};

const PLACEHOLDER: Record<Context, string> = {
  dashboard:
    "What can we help you with? — e.g., 'I'm not sure which dispute round to start with.'",
  "get-report":
    "What's happening? — e.g., 'MyScoreIQ won't let me sign in.'",
};

export function HelpCard({ context }: { context: Context }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: SUBJECT[context],
          body: trimmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        threadId?: string;
        message?: string;
      };
      if (!data.ok || !data.threadId) {
        setErr(data.message ?? "Couldn't send. Try again.");
        return;
      }
      router.push(
        `/dashboard/messages?threadId=${encodeURIComponent(data.threadId)}`,
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Concierge support
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Need a hand?
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-fg-muted">
            Real humans, no scripted bots. We&apos;ll guide you through the
            tricky parts.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30 sm:inline-flex">
          We typically reply within a day
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {TIPS[context].map((t) => (
          <li key={t.q}>
            <Link
              href={t.href}
              className="group flex h-full items-start gap-2 rounded-2xl border border-border bg-surface-muted/40 p-3 transition hover:border-fg/20 hover:bg-surface-muted/70"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M6 6.5a2 2 0 014 0c0 1.2-1.5 1.3-2 2.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-fg">
                {t.q}
              </span>
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg"
                fill="none"
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-[12px] text-fg-muted">
          Still stuck?{" "}
          <Link href="/dashboard/messages" className="underline hover:text-fg">
            See your messages
          </Link>{" "}
          or send us one below.
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90"
        >
          {open ? "Close" : "Message support"}
          <svg
            viewBox="0 0 16 16"
            className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
            fill="none"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-2xl border border-border bg-surface-muted/40 p-3">
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={PLACEHOLDER[context]}
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-fg-subtle">
              Subject: &quot;{SUBJECT[context]}&quot;
            </span>
            <button
              type="button"
              onClick={send}
              disabled={busy || !body.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-3.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send to support"}
            </button>
          </div>
          {err && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
              {err}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
