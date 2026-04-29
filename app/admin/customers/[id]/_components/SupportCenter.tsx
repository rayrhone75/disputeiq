"use client";

import type { TimelineRow } from "./types";

// Support Command Center — section 4.
//
// We don't have a notes/tickets schema yet, so this card surfaces the
// support signals we *do* have:
//   - Last touch (most recent audit entry — gives the support agent a
//     real "when did we last interact" timestamp without inventing data).
//   - Action-needed flag derived from the timeline + aggregates.
// Notes / Tickets / Follow-ups render disabled with "Coming soon".

export function SupportCenter({
  timeline,
  needsHelp,
  needsHelpReason,
}: {
  timeline: TimelineRow[];
  needsHelp: boolean;
  needsHelpReason: string;
}) {
  const lastTouch = timeline[0] ?? null;

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Support
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Customer support center
          </h3>
        </div>
        {needsHelp && (
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Needs help
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Tile
          label="Last touch"
          value={
            lastTouch
              ? formatRelative(lastTouch.createdAt)
              : "No recorded interactions"
          }
          hint={lastTouch ? lastTouch.action.replace(/_/g, " ") : undefined}
        />
        <Tile
          label="Health"
          value={needsHelp ? "Needs follow-up" : "On track"}
          hint={needsHelp ? needsHelpReason : "No flags"}
          tone={needsHelp ? "rose" : "emerald"}
        />
        <Tile
          label="Open tickets"
          value="—"
          hint="Coming soon"
          dim
        />
        <Tile
          label="Next follow-up"
          value="—"
          hint="Coming soon"
          dim
        />
      </div>

      <div className="mt-5">
        <textarea
          disabled
          rows={3}
          placeholder="Internal notes about this customer (coming soon)…"
          className="w-full cursor-not-allowed rounded-2xl border border-border bg-surface-muted/50 p-3 text-sm text-fg-subtle placeholder:text-fg-subtle"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-fg-subtle">
            Notes, tickets, and scheduled follow-ups are coming soon. For now
            the audit timeline below is the source of truth.
          </span>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-surface-muted px-3 py-1.5 text-[11px] font-semibold text-fg-subtle"
          >
            Save note
          </button>
        </div>
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  dim,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "rose";
  dim?: boolean;
}) {
  const tones =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-200"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-200"
        : "text-fg";
  return (
    <div
      className={[
        "rounded-2xl border border-border bg-surface p-4",
        dim ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 truncate text-lg font-semibold ${tones}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-fg-muted">{hint}</div>}
    </div>
  );
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}
