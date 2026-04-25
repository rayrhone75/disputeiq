"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  body: string;
  category: string;
  pinned: boolean;
  isInternal: boolean;
  createdAt: string | Date;
  author: { email: string } | null;
};

const CATEGORIES = ["general", "billing", "report", "escalation"] as const;

export function SupportNoteList({
  userId,
  initialNotes,
}: {
  userId: string;
  initialNotes: Note[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("general");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, body, category, pinned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "CREATE_FAILED");
      setNotes((prev) => [json.note, ...prev]);
      setBody("");
      setPinned(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/admin/support/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add an internal note — staff-only, never shown to the customer."
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="rounded-lg border border-border-strong bg-surface px-2 py-1"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-fg-muted">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin to top
          </label>
          <button
            type="button"
            onClick={create}
            disabled={busy || !body.trim()}
            className="ml-auto rounded-lg bg-fg px-3 py-1.5 font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add note"}
          </button>
        </div>
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-fg-muted">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.pinned
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-border bg-surface"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-fg-muted">
                <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-fg-muted">
                  {n.category}
                </span>
                {n.pinned && (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-800">
                    pinned
                  </span>
                )}
                <span className="ml-auto font-mono">
                  {n.author?.email ?? "system"} · {new Date(n.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="ml-2 rounded-md border border-border-strong px-2 py-0.5 text-[10px] font-semibold text-fg-muted hover:bg-surface-muted/60"
                >
                  delete
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-fg">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
