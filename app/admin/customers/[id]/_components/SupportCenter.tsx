"use client";

import { useState } from "react";
import { useToast } from "./toast";
import type {
  CustomerNote,
  CustomerFollowUp,
  NoteCategory,
  TimelineRow,
} from "./types";

// Support Command Center — section 4.
//
// Live in Phase 1:
//   - Internal notes (create / edit / pin / delete) per customer.
//   - Follow-up reminders (create + mark done/dismissed).
// "Last touch" is still derived from the audit timeline so the support
// agent gets a real "when did we last interact" signal even if no note
// exists yet.

const CATEGORIES: { value: NoteCategory; label: string; tone: string }[] = [
  {
    value: "general",
    label: "General",
    tone: "bg-surface-muted text-fg-muted",
  },
  {
    value: "billing",
    label: "Billing",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  {
    value: "escalation",
    label: "Escalation",
    tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  },
  {
    value: "compliance",
    label: "Compliance",
    tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  },
];

const CAT_TONE = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.tone]),
) as Record<NoteCategory, string>;

export function SupportCenter({
  customerId,
  notes,
  followUps,
  timeline,
  needsHelp,
  needsHelpReason,
  onChange,
}: {
  customerId: string;
  notes: CustomerNote[];
  followUps: CustomerFollowUp[];
  timeline: TimelineRow[];
  needsHelp: boolean;
  needsHelpReason: string;
  onChange: () => void;
}) {
  const { push } = useToast();
  const lastTouch = timeline[0] ?? null;
  const pendingFollowUps = followUps.filter((f) => f.status === "pending");
  const nextFollowUp = pendingFollowUps[0] ?? null;

  // Note composer state
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<NoteCategory>("general");
  const [draftPinned, setDraftPinned] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Follow-up composer state
  const [fuBody, setFuBody] = useState("");
  const [fuDueDate, setFuDueDate] = useState(() => defaultDueDate());
  const [savingFu, setSavingFu] = useState(false);

  async function submitNote() {
    const body = draft.trim();
    if (!body) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          category: draftCategory,
          pinned: draftPinned,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        push("error", "Couldn't save note", data.message ?? undefined);
        return;
      }
      push("success", "Note saved");
      setDraft("");
      setDraftPinned(false);
      onChange();
    } catch (err) {
      push("error", "Couldn't save note", (err as Error).message);
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note?")) return;
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/notes/${noteId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        push("error", "Couldn't delete note", data.message ?? undefined);
        return;
      }
      push("success", "Note deleted");
      onChange();
    } catch (err) {
      push("error", "Couldn't delete note", (err as Error).message);
    }
  }

  async function togglePin(note: CustomerNote) {
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/notes/${note._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !note.pinned }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        push("error", "Couldn't update pin", data.message ?? undefined);
        return;
      }
      onChange();
    } catch (err) {
      push("error", "Couldn't update pin", (err as Error).message);
    }
  }

  async function submitFollowUp() {
    const body = fuBody.trim();
    if (!body) return;
    const dueAt = new Date(fuDueDate).getTime();
    if (!Number.isFinite(dueAt)) {
      push("error", "Pick a due date");
      return;
    }
    setSavingFu(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, dueAt }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        push("error", "Couldn't save follow-up", data.message ?? undefined);
        return;
      }
      push("success", "Follow-up scheduled");
      setFuBody("");
      setFuDueDate(defaultDueDate());
      onChange();
    } catch (err) {
      push("error", "Couldn't save follow-up", (err as Error).message);
    } finally {
      setSavingFu(false);
    }
  }

  async function setFollowUpStatus(
    fu: CustomerFollowUp,
    status: CustomerFollowUp["status"],
  ) {
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/follow-up/${fu._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        push("error", "Couldn't update follow-up", data.message ?? undefined);
        return;
      }
      push("success", status === "done" ? "Follow-up complete" : "Follow-up dismissed");
      onChange();
    } catch (err) {
      push("error", "Couldn't update follow-up", (err as Error).message);
    }
  }

  // Pinned notes float to the top regardless of timestamp.
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

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
          label="Open notes"
          value={String(notes.length)}
          hint={
            notes.filter((n) => n.pinned).length > 0
              ? `${notes.filter((n) => n.pinned).length} pinned`
              : "Visible to admins only"
          }
        />
        <Tile
          label="Next follow-up"
          value={nextFollowUp ? formatDueDate(nextFollowUp.dueAt) : "None scheduled"}
          hint={nextFollowUp ? truncate(nextFollowUp.body, 60) : "Schedule one below"}
        />
      </div>

      {/* ── Notes ─────────────────────────────────────────────────── */}
      <div className="mt-7">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Internal notes
        </h4>

        <div className="mt-3 rounded-2xl border border-border bg-surface-muted/40 p-3">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a private note about this customer (admins only)…"
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as NoteCategory)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-[11px] font-medium text-fg-muted">
              <input
                type="checkbox"
                checked={draftPinned}
                onChange={(e) => setDraftPinned(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Pin to top
            </label>
            <span className="ml-auto" />
            <button
              type="button"
              onClick={submitNote}
              disabled={savingNote || !draft.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-3.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {savingNote ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>

        {sortedNotes.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-4 text-center text-[12px] text-fg-muted">
            No notes yet. Notes are admin-only and never visible to the customer.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {sortedNotes.map((n) => (
              <li
                key={n._id}
                className={[
                  "rounded-2xl border p-3.5",
                  n.pinned
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-border bg-surface",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${CAT_TONE[n.category]}`}
                  >
                    {n.category}
                  </span>
                  {n.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                      Pinned
                    </span>
                  )}
                  <span className="text-[11px] text-fg-subtle">
                    {n.authorEmail} · {formatRelative(n.createdAt)}
                    {n.updatedAt > n.createdAt
                      ? ` · edited ${formatRelative(n.updatedAt)}`
                      : ""}
                  </span>
                  <span className="ml-auto" />
                  <button
                    type="button"
                    onClick={() => togglePin(n)}
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted hover:bg-surface-muted hover:text-fg"
                  >
                    {n.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNote(n._id)}
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-fg">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Follow-ups ────────────────────────────────────────────── */}
      <div className="mt-7">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Follow-ups
        </h4>

        <div className="mt-3 rounded-2xl border border-border bg-surface-muted/40 p-3">
          <input
            type="text"
            value={fuBody}
            onChange={(e) => setFuBody(e.target.value)}
            placeholder="Reason — e.g., 'Confirm Round 2 packets sent'"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={fuDueDate}
              onChange={(e) => setFuDueDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg"
            />
            <span className="ml-auto" />
            <button
              type="button"
              onClick={submitFollowUp}
              disabled={savingFu || !fuBody.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-3.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {savingFu ? "Saving…" : "Schedule follow-up"}
            </button>
          </div>
        </div>

        {followUps.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-4 text-center text-[12px] text-fg-muted">
            No follow-ups scheduled.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {followUps.map((f) => {
              const overdue =
                f.status === "pending" && f.dueAt < Date.now();
              const tone =
                f.status === "done"
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  : f.status === "dismissed"
                    ? "border-border bg-surface-muted/40 opacity-70"
                    : overdue
                      ? "border-rose-200 bg-rose-50/40 dark:border-rose-500/30 dark:bg-rose-500/10"
                      : "border-violet-200 bg-violet-50/40 dark:border-violet-500/30 dark:bg-violet-500/10";
              return (
                <li
                  key={f._id}
                  className={`rounded-2xl border p-3.5 ${tone}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                      {f.status}
                      {overdue ? " · overdue" : ""}
                    </span>
                    <span className="text-[11px] text-fg-subtle">
                      Due {formatDueDate(f.dueAt)}
                    </span>
                    <span className="ml-auto" />
                    {f.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFollowUpStatus(f, "done")}
                          className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-700"
                        >
                          Mark done
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowUpStatus(f, "dismissed")}
                          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted hover:bg-surface-muted hover:text-fg"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-fg">{f.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-200"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-200"
        : "text-fg";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 truncate text-lg font-semibold ${cls}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-fg-muted">{hint}</div>}
    </div>
  );
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  // datetime-local needs a string without seconds + timezone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDueDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < 0) {
    const a = -diff;
    if (a < hr) return `in ${Math.ceil(a / min)}m`;
    if (a < day) return `in ${Math.ceil(a / hr)}h`;
    return `in ${Math.ceil(a / day)}d`;
  }
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
