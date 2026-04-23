"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminReportDeleteButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this report and all its tradelines? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/delete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      router.refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </div>
  );
}
