"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Legacy "paste report text" form on /dashboard/reports.
//
// Backend (POST /api/reports/paste) auto-detects whether the body is JSON
// (modern MyScoreIQ / IdentityIQ report) or plain text (PDF-extracted),
// and routes through the appropriate pipeline. JSON imports come back
// with a `redirectTo` of /dashboard/get-report?imported=1 so the user
// lands on the connected dashboard; legacy text imports keep the
// /dashboard/reports/[id] redirect.
export function ReportPasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reportId: string | null;
    parsedCount: number;
    parseStatus: string;
    reviewFlags: string[];
    redirectTo?: string;
    message?: string;
  } | null>(null);

  async function submit() {
    if (text.length < 100) {
      setErr("Report text must be at least 100 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/reports/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface server-side message before throwing so the user gets a
        // useful error instead of the generic fallback.
        throw new Error(data?.message ?? data?.error ?? "Paste import failed");
      }
      setResult(data);
      if (data.parsedCount > 0) {
        router.push(data.redirectTo ?? `/dashboard/reports/${data.reportId}`);
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const looksLikeJson = text.trim().startsWith("{") || text.trim().startsWith("[");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-fg">Paste Report JSON</h3>
      <p className="text-xs text-fg-muted">
        Open your MyScoreIQ report (the JSON page), select all (Ctrl+A), copy
        (Ctrl+C), then paste below. We auto-detect JSON and run it through
        the same import pipeline as the one-click Connect Report flow.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Paste your MyScoreIQ JSON here, e.g. {"borrower": ..., "tradelines": [...]}'
        rows={10}
        className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs font-mono text-fg focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-fg-subtle">
          {text.length.toLocaleString()} characters
          {text.length >= 100 && (
            <>
              {" · "}
              <span
                className={
                  looksLikeJson
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-fg-subtle"
                }
              >
                {looksLikeJson ? "JSON detected" : "plain text"}
              </span>
            </>
          )}
        </span>
        <button
          onClick={submit}
          disabled={busy || text.length < 100}
          className="rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas disabled:opacity-50"
        >
          {busy
            ? looksLikeJson
              ? "Importing JSON…"
              : "Parsing…"
            : looksLikeJson
              ? "Import JSON"
              : "Import from text"}
        </button>
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {result && result.parsedCount === 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          <p className="font-semibold">
            {looksLikeJson
              ? "Imported but no tradelines detected in the JSON"
              : "Parser couldn't extract tradelines"}
          </p>
          <p className="mt-1">
            {looksLikeJson
              ? "Your JSON saved successfully, but the MyScoreIQ adapter didn't find any tradeline rows. The body may be truncated, a wrong endpoint, or a different report shape — try copying the page again."
              : "The text was saved but no structured data was found. If you copied JSON, the auto-detect should have routed you to the JSON path — re-paste with no whitespace before the leading {. Otherwise upload the PDF instead, or contact support."}
          </p>
          {result.reviewFlags.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
              Flags: {result.reviewFlags.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
