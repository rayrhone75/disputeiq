"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReportUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reportId: string;
    parsedCount: number;
    signalCount: number;
    parseStatus: string;
    reviewFlags: string[];
  } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/reports/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      setResult(data);
      if (data.parsedCount > 0) {
        router.push(`/dashboard/reports/${data.reportId}`);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface-muted/40 px-6 py-12 text-center transition hover:border-accent-500 hover:bg-accent-50/30 dark:hover:bg-accent-500/10">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fg to-accent-600" />
        <p className="font-display text-base font-semibold text-fg">
          {busy ? "Uploading & parsing…" : "Drop your tri-merge PDF"}
        </p>
        <p className="text-xs text-fg-muted">
          Encrypted on upload · Parsed into tradelines automatically
        </p>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onChange}
          disabled={busy}
        />
      </label>

      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}

      {result && result.parsedCount === 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">
            {result.parseStatus === "partial_needs_review"
              ? "Report uploaded — parser needs help"
              : "Report uploaded — no tradelines found"}
          </p>
          <p className="mt-1 text-xs">
            The PDF was saved but the parser could not extract structured tradelines.
            This often happens with scanned or image-based PDFs. Try the{" "}
            <strong>paste text</strong> method below, or contact support.
          </p>
          {result.reviewFlags.length > 0 && (
            <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">
              Parser flags: {result.reviewFlags.join(", ")}
            </p>
          )}
        </div>
      )}

      {result && result.parsedCount > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="font-semibold">
            Found {result.parsedCount} account(s)
            {result.signalCount > 0 && ` with ${result.signalCount} potential issue(s)`}
          </p>
          <p className="mt-1 text-xs">Redirecting to analysis…</p>
        </div>
      )}
    </div>
  );
}
