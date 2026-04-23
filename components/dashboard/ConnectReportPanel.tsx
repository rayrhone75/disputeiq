"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "auto" | "upload" | "paste";

// ConnectReportPanel — customer-facing handoff for importing an IdentityIQ
// credit report. Opens as an inline expandable drawer on /dashboard/get-report.
//
// Three paths, all real, none simulated:
//   1. Auto-connect — user pastes the IdentityIQ JSON URL + their session
//      cookie; DisputeIQ's server fetches the report directly.
//   2. Upload .json — user saves the IdentityIQ report as JSON and uploads it.
//   3. Paste JSON — user pastes the raw body text.
//
// After any path completes a raw capture, we call the normalization endpoint
// to populate tradelines / inquiries / dispute candidates, then refresh the
// page so the status chip updates.
export function ConnectReportPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-connect inputs
  const [reportUrl, setReportUrl] = useState(
    "https://member.identityiq.com/CreditReport.aspx?view=json",
  );
  const [cookieHeader, setCookieHeader] = useState("");

  // Upload input
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Paste input
  const [bodyText, setBodyText] = useState("");

  async function createImport(): Promise<string> {
    const res = await fetch("/api/reports/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: mode === "auto" ? reportUrl : undefined }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? json.error ?? "CREATE_FAILED");
    return json.import.id as string;
  }

  async function normalize(importId: string) {
    const res = await fetch(`/api/reports/import/${importId}/normalize`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? json.error ?? "NORMALIZE_FAILED");
    return json as { tradelineCount: number; candidatesCreated: number };
  }

  async function runAuto() {
    if (!cookieHeader.trim()) {
      setError("Paste your IdentityIQ session cookie first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const importId = await createImport();
      const fetchRes = await fetch(`/api/reports/import/${importId}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: reportUrl, cookieHeader }),
      });
      const fetchJson = await fetchRes.json();
      if (!fetchRes.ok) {
        throw new Error(fetchJson.message ?? fetchJson.error ?? "FETCH_FAILED");
      }
      const summary = await normalize(importId);
      setSuccess(
        `Report imported — ${summary.tradelineCount} tradelines, ${summary.candidatesCreated} dispute candidates detected.`,
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runUpload() {
    if (!uploadFile) {
      setError("Pick a .json file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const importId = await createImport();
      const fd = new FormData();
      fd.append("file", uploadFile);
      const up = await fetch(`/api/reports/import/${importId}/upload`, {
        method: "POST",
        body: fd,
      });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.message ?? upJson.error ?? "UPLOAD_FAILED");
      const summary = await normalize(importId);
      setSuccess(
        `Report imported — ${summary.tradelineCount} tradelines, ${summary.candidatesCreated} dispute candidates detected.`,
      );
      setUploadFile(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runPaste() {
    if (!bodyText.trim()) {
      setError("Paste the JSON body first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const importId = await createImport();
      const res = await fetch(`/api/reports/import/${importId}/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "PASTE_FAILED");
      const summary = await normalize(importId);
      setSuccess(
        `Report imported — ${summary.tradelineCount} tradelines, ${summary.candidatesCreated} dispute candidates detected.`,
      );
      setBodyText("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Connect Credit Report
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("upload");
            setOpen(true);
          }}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Upload JSON Manually
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("paste");
            setOpen(true);
          }}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Paste Report JSON
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Connect your IdentityIQ report
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Pick how you want to bring it in
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(
          [
            { k: "auto", label: "Auto-connect (URL + cookie)" },
            { k: "upload", label: "Upload .json" },
            { k: "paste", label: "Paste JSON" },
          ] as Array<{ k: Mode; label: string }>
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => {
              setMode(t.k);
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-lg px-3 py-1.5 font-semibold ${
              mode === t.k
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "auto" && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
            <p className="font-semibold text-slate-900">How to get your session cookie</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Sign in to IdentityIQ in a new tab.</li>
              <li>
                Open Developer Tools (F12) → Application → Cookies → select the IdentityIQ site.
              </li>
              <li>Copy the full Cookie header value and paste it below.</li>
            </ol>
            <p className="mt-2 text-[11px] text-slate-500">
              Your cookie is sent only to DisputeIQ&apos;s server to fetch your report — never
              stored as plaintext.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Report URL</span>
            <input
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Session cookie</span>
            <textarea
              value={cookieHeader}
              onChange={(e) => setCookieHeader(e.target.value)}
              rows={4}
              placeholder="ASP.NET_SessionId=...; other=..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={runAuto}
            className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Fetch my report"}
          </button>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-600">
            Save your IdentityIQ report as a <code className="font-mono">.json</code> file and
            upload it (max 10 MB).
          </p>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          {uploadFile && (
            <p className="text-xs text-slate-500">
              Selected: <span className="font-mono">{uploadFile.name}</span> ·{" "}
              {(uploadFile.size / 1024).toFixed(1)} KB
            </p>
          )}
          <button
            type="button"
            disabled={busy || !uploadFile}
            onClick={runUpload}
            className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload & import"}
          </button>
        </div>
      )}

      {mode === "paste" && (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-600">
            Paste the full JSON body from your IdentityIQ report page.
          </p>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={12}
            placeholder='{"borrower": {...}, "tradelines": [...]}'
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            disabled={busy || !bodyText.trim()}
            onClick={runPaste}
            className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import pasted JSON"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </p>
      )}
    </div>
  );
}
