"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReportPasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reportId: string;
    parsedCount: number;
    parseStatus: string;
    reviewFlags: string[];
  } | null>(null);

  async function submit() {
    if (text.length < 100) {
      setErr("Report text must be at least 100 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Paste import failed");
      setResult(data);
      if (data.parsedCount > 0) {
        router.push(`/dashboard/reports/${data.reportId}`);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-900">Paste report text</h3>
      <p className="text-xs text-ink-600">
        Open your MyFreeScoreIQ report, select all text (Ctrl+A), copy it (Ctrl+C), then paste it
        below. We'll extract tradelines from the text automatically.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your full credit report text here…"
        rows={10}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-400">{text.length.toLocaleString()} characters</span>
        <button
          onClick={submit}
          disabled={busy || text.length < 100}
          className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Parsing…" : "Import from text"}
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {result && result.parsedCount === 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">Parser couldn't extract tradelines</p>
          <p className="mt-1">
            The text was saved but no structured data was found. This often happens with
            non-standard report formats. Try uploading the PDF instead, or contact support.
          </p>
          {result.reviewFlags.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-700">
              Flags: {result.reviewFlags.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
