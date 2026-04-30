"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HealthSignal } from "@/lib/admin/health";

// "Customers needing attention" feed for /admin home.
//
// Pulls /api/admin/health-feed and renders the top rows. Each row deep
// links into Customer 360 for that customer.

type Row = {
  userId: string;
  email: string;
  isVip: boolean;
  signal: HealthSignal;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; rows: Row[] }
  | { kind: "error"; message: string };

export function AttentionFeed() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/health-feed", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          rows?: Row[];
          message?: string;
        };
        if (cancelled) return;
        if (data.ok) {
          setState({ kind: "ready", rows: data.rows ?? [] });
        } else {
          setState({
            kind: "error",
            message: data.message ?? "Could not load attention feed.",
          });
        }
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: (err as Error).message });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Customer success
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">
            Customers needing attention
          </h2>
        </div>
        <Link
          href="/admin/customers"
          className="text-xs font-semibold text-fg-muted hover:text-fg"
        >
          All customers →
        </Link>
      </div>

      {state.kind === "loading" && (
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-surface-muted/70"
            />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.rows.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-muted/40 p-6 text-center">
          <p className="text-sm font-semibold text-fg">All clear</p>
          <p className="mt-1 text-[12px] text-fg-muted">
            No customers are currently flagged as needing attention.
          </p>
        </div>
      )}

      {state.kind === "ready" && state.rows.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {state.rows.map((r) => (
            <li key={r.userId}>
              <Link
                href={`/admin/customers/${r.userId}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-transparent bg-surface px-4 py-3 transition hover:-translate-y-0.5 hover:border-border hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)]"
              >
                <div className="flex items-center gap-3">
                  <SeverityDot severity={r.signal.severity} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">
                        {r.email || r.userId.slice(0, 24)}
                      </span>
                      {r.isVip && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                          ★ VIP
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.18em] ${severityPill(r.signal.severity)}`}
                      >
                        {r.signal.label}
                      </span>
                      <span className="truncate">{r.signal.reason}</span>
                    </div>
                  </div>
                </div>
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg"
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
      )}
    </section>
  );
}

function SeverityDot({
  severity,
}: {
  severity: HealthSignal["severity"];
}) {
  const cls =
    severity === "alert"
      ? "bg-rose-500"
      : severity === "warn"
        ? "bg-amber-500"
        : "bg-sky-500";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        severity === "alert"
          ? "bg-rose-50 dark:bg-rose-500/15"
          : severity === "warn"
            ? "bg-amber-50 dark:bg-amber-500/15"
            : "bg-sky-50 dark:bg-sky-500/15"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${cls}`} />
    </span>
  );
}

function severityPill(severity: HealthSignal["severity"]): string {
  if (severity === "alert") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }
  if (severity === "warn") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
}
