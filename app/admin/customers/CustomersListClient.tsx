"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Admin Customers list — premium minimal index. Lets an admin land on
// this route and click into a Customer 360 detail page. Data comes from
// the existing role-gated `creditImports.adminListUsers` query; we
// surface it via /api/admin/customers/list so the page itself stays
// fail-soft (no SSR Convex coupling).

type Row = {
  id: string;
  email: string;
  isVip?: boolean;
  createdAt?: number;
  role?: string;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; rows: Row[] }
  | { kind: "error"; message: string };

export function CustomersListClient() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/customers/list", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          rows?: Row[];
          message?: string;
        };
        if (cancelled) return;
        if (data.ok && Array.isArray(data.rows)) {
          setState({ kind: "ready", rows: data.rows });
        } else {
          setState({
            kind: "error",
            message: data.message ?? "Could not load customers.",
          });
        }
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = filter.trim().toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter((r) =>
      `${r.email} ${r.id}`.toLowerCase().includes(q),
    );
  }, [state, filter]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Customers
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Click into any customer for a 360 view of their account, file, and
          activity.
        </p>
      </header>

      <div className="rounded-3xl bg-surface p-1 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <div className="flex-1 min-w-[200px]">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search email or ID…"
              className="w-full rounded-xl border border-border bg-surface-muted/50 px-3.5 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
            />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
            {state.kind === "ready" ? `${filtered.length} of ${state.rows.length}` : ""}
          </span>
        </div>

        {state.kind === "loading" && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-surface-muted/70"
              />
            ))}
          </div>
        )}

        {state.kind === "error" && (
          <div className="m-2 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <ul className="space-y-1 p-2">
            {filtered.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-fg-muted">
                {state.rows.length === 0
                  ? "No customers yet."
                  : "No matches for that search."}
              </li>
            ) : (
              filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/customers/${r.id}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-transparent bg-transparent px-4 py-3 transition hover:border-border hover:bg-surface-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                        {initials(r.email)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-fg">
                            {r.email}
                          </span>
                          {r.isVip && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                              ★ VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-fg-subtle">
                          {r.id.slice(0, 24)}
                          {r.createdAt
                            ? ` · joined ${formatJoined(r.createdAt)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-fg"
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
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatJoined(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(email: string): string {
  if (!email) return "·";
  const [local] = email.split("@");
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}
