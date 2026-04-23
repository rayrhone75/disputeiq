"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "fetch" | "paste" | "upload" | "normalize" | "inspect";

export function ImportDetailPanel({
  importId,
  hasRaw,
  defaultUrl,
}: {
  importId: string;
  hasRaw: boolean;
  defaultUrl: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(hasRaw ? "normalize" : "paste");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  // Fetch form state
  const [url, setUrl] = useState(defaultUrl);
  const [cookie, setCookie] = useState("");
  const [bearer, setBearer] = useState("");

  // Paste form state
  const [bodyText, setBodyText] = useState("");

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Normalize options
  const [replace, setReplace] = useState(true);

  async function call(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP_${res.status}`);
      setResult(json);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doFetch() {
    if (!url) {
      setError("URL is required.");
      return;
    }
    await call(`/api/admin/credit-imports/${importId}/fetch`, {
      url,
      cookieHeader: cookie || undefined,
      bearerToken: bearer || undefined,
    });
  }

  async function doPaste() {
    if (!bodyText.trim()) {
      setError("Paste raw JSON first.");
      return;
    }
    await call(`/api/admin/credit-imports/${importId}/paste`, { bodyText });
    setBodyText("");
  }

  async function doNormalize() {
    await call(`/api/admin/credit-imports/${importId}/rerun`, { replace });
  }

  async function doUpload() {
    if (!uploadFile) {
      setError("Pick a .json file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch(`/api/admin/credit-imports/${importId}/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP_${res.status}`);
      setResult(json);
      setUploadFile(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function inspectRaw() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/credit-imports/${importId}/inspect-raw`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP_${res.status}`);
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(key);
        setError(null);
        setResult(null);
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
        tab === key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabBtn("fetch", "Fetch from provider")}
        {tabBtn("paste", "Paste raw JSON")}
        {tabBtn("upload", "Upload .json")}
        {tabBtn("normalize", "Rerun normalization")}
        {tabBtn("inspect", "Inspect raw (redacted)")}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white/60 p-4">
        {tab === "fetch" && (
          <div className="space-y-3">
            <p className="text-xs text-ink-500">
              Paste the session cookie header or bearer token captured from the authenticated
              browser session, then fetch the provider JSON directly.
            </p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://.../CreditReport.aspx?view=json"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="Cookie header (optional)"
              rows={3}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs"
            />
            <input
              value={bearer}
              onChange={(e) => setBearer(e.target.value)}
              placeholder="Bearer token (optional)"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              disabled={busy}
              onClick={doFetch}
              className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Fetching…" : "Fetch + capture"}
            </button>
          </div>
        )}

        {tab === "paste" && (
          <div className="space-y-3">
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={14}
              placeholder='Paste the full JSON body here'
              className="w-full rounded-lg border border-ink-200 bg-ink-50/50 px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              disabled={busy || !bodyText.trim()}
              onClick={doPaste}
              className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Capturing…" : "Capture pasted JSON"}
            </button>
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            <p className="text-xs text-ink-500">
              Upload a single <code className="font-mono">.json</code> file (up to 10 MB). The file
              is validated as JSON, encrypted, and stored alongside this import.
            </p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            />
            {uploadFile && (
              <p className="text-xs text-ink-500">
                Selected: <span className="font-mono">{uploadFile.name}</span> ·{" "}
                {(uploadFile.size / 1024).toFixed(1)} KB
              </p>
            )}
            <button
              type="button"
              disabled={busy || !uploadFile}
              onClick={doUpload}
              className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload + capture"}
            </button>
          </div>
        )}

        {tab === "normalize" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              Replace previously-normalized rows (recommended)
            </label>
            <button
              type="button"
              disabled={busy || !hasRaw}
              onClick={doNormalize}
              className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Running…" : "Run normalization"}
            </button>
            {!hasRaw && (
              <p className="text-xs text-ink-500">Capture raw JSON first (Fetch or Paste).</p>
            )}
          </div>
        )}

        {tab === "inspect" && (
          <div className="space-y-3">
            <p className="text-xs text-ink-500">
              Decrypts the stored raw payload and returns a PII-redacted copy for inspection. SSNs,
              DOBs, account numbers, phones, and emails are masked before leaving the server.
            </p>
            <button
              type="button"
              disabled={busy || !hasRaw}
              onClick={inspectRaw}
              className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Decrypting…" : "Inspect redacted raw"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-700">
          {error}
        </p>
      )}

      {result != null && (
        <pre className="max-h-[420px] overflow-auto rounded-2xl border border-ink-100 bg-ink-900/5 p-3 font-mono text-[11px] text-ink-800">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
