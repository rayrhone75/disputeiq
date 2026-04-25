"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string;
  role: string;
  archivedAt: string | null;
  createdAt: string;
  _count: { creditImports: number; disputes: number; supportNotes: number };
};

export function SupportSearch() {
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (archived) params.set("archived", "1");
        const res = await fetch(`/api/admin/support/search?${params.toString()}`);
        const json = await res.json();
        setUsers(json.users ?? []);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q, archived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, user id, or import id"
          className="flex-1 min-w-[260px] rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Include archived
        </label>
      </div>

      {loading && <p className="text-xs text-fg-muted">Loading…</p>}

      {!loading && users.length === 0 && (
        <p className="text-sm text-fg-muted">No customers match that search.</p>
      )}

      <ul className="divide-y divide-border text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-mono text-sm text-fg">
                {u.email}{" "}
                {u.archivedAt && (
                  <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-fg-muted">
                    archived
                  </span>
                )}
              </p>
              <p className="text-[11px] text-fg-muted">
                id {u.id.slice(0, 10)}… · role {u.role} · {u._count.creditImports} imports ·{" "}
                {u._count.disputes} disputes · {u._count.supportNotes} notes
              </p>
            </div>
            <Link
              href={`/admin/support/${u.id}`}
              className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-fg/90"
            >
              Open console →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
