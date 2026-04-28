"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_JSON_REPORT_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

// One-click MyScoreIQ Connect Report panel.
//
// Primary CTA: "Connect MyScoreIQ Report" → POST /api/reports/import/myscoreiq/connect.
// The endpoint tries a server-side fetch of the user's MyScoreIQ JSON URL.
// In practice MyScoreIQ blocks the request without a logged-in browser
// session, so we transition to a browser-assisted flow where the user logs
// in to MyScoreIQ in a new tab and then either:
//   1. Returns and clicks Retry (we attempt the server fetch again — works
//      only if MyScoreIQ ever exposes a public API or the user has set up
//      a session passthrough), OR
//   2. Opens the JSON URL in a new tab to grab the body, then auto-imports
//      it via a clipboard read.
//
// Manual upload + paste are kept as a "More options" disclosure so they
// don't dominate the UX.

type ConnectStatus =
  | "idle"
  | "loading"
  | "connected"
  | "needs_login"
  | "failed";

type ConnectResult =
  | {
      status: "connected";
      importId: string;
      tradelineCount: number;
      candidatesCreated: number;
    }
  | {
      status: "requires_user_action";
      importId: string;
      message: string;
      affiliateUrl: string;
      jsonUrl: string;
      reason: string;
    }
  | { status: "failed"; importId?: string; message: string; code: string };

export function ConnectReportPanel({
  jsonReportUrl = DEFAULT_JSON_REPORT_URL,
  retryImportId,
}: {
  jsonReportUrl?: string;
  retryImportId?: string | null;
} = {}) {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsLoginInfo, setNeedsLoginInfo] = useState<{
    affiliateUrl: string;
    jsonUrl: string;
    reason: string;
  } | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Sub-state for the clipboard auto-import button inside needs_login.
  // Lives separately from `status` so the user can click it from the
  // amber needs_login card without losing context.
  const [clipBusy, setClipBusy] = useState(false);
  const [clipMsg, setClipMsg] = useState<string | null>(null);
  const [clipErr, setClipErr] = useState<string | null>(null);
  // Becomes true once user has clicked "Open JSON Tab" — drives the visual
  // emphasis on the Auto-Import button (the natural next step).
  const [jsonTabOpened, setJsonTabOpened] = useState(false);

  async function connect() {
    setStatus("loading");
    setErrorMsg(null);
    setResultMsg(null);
    try {
      const res = await fetch("/api/reports/import/myscoreiq/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as ConnectResult;

      if (data.status === "connected") {
        setStatus("connected");
        setResultMsg(
          `Report connected successfully — ${data.tradelineCount} tradelines, ${data.candidatesCreated} dispute candidates detected.`,
        );
        router.refresh();
        return;
      }
      if (data.status === "requires_user_action") {
        setStatus("needs_login");
        setNeedsLoginInfo({
          affiliateUrl: data.affiliateUrl,
          jsonUrl: data.jsonUrl,
          reason: data.reason,
        });
        return;
      }
      setStatus("failed");
      setErrorMsg(data.message || "Connect failed.");
    } catch (err) {
      setStatus("failed");
      setErrorMsg((err as Error).message);
    }
  }

  async function retryConnect() {
    setRetryAttempts((n) => n + 1);
    await connect();
  }

  function openMyScoreIQ() {
    if (typeof window === "undefined") return;
    window.open(
      needsLoginInfo?.affiliateUrl ??
        "https://member.myscoreiq.com/get-fico-preferred.aspx?offercode=43214399",
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openJsonTab() {
    if (typeof window === "undefined") return;
    window.open(
      needsLoginInfo?.jsonUrl ?? jsonReportUrl,
      "_blank",
      "noopener,noreferrer",
    );
    setJsonTabOpened(true);
    setClipErr(null);
    setClipMsg(null);
  }

  // Clipboard auto-import.
  // User has opened the MyScoreIQ JSON tab in their authenticated browser
  // session, hit Ctrl+A → Ctrl+C, and returned here. We read the clipboard
  // text (requires user gesture + permission, both granted by clicking this
  // button), validate it parses as JSON, and feed it through the existing
  // import → paste → normalize pipeline. Same backend that the manual paste
  // form uses; just a smoother front door.
  async function importFromClipboard() {
    setClipBusy(true);
    setClipErr(null);
    setClipMsg(null);
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.readText !== "function"
      ) {
        throw new Error(
          "Your browser doesn't support clipboard access. Use Paste JSON in More options below.",
        );
      }
      let text: string;
      try {
        text = await navigator.clipboard.readText();
      } catch {
        throw new Error(
          "Clipboard access was denied. Allow clipboard read in your browser, or use Paste JSON in More options below.",
        );
      }
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error(
          "Clipboard is empty. Open the JSON tab, press Ctrl+A then Ctrl+C, then click again.",
        );
      }
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        throw new Error(
          "Clipboard doesn't look like JSON. Make sure you copied the body of the MyScoreIQ JSON page (Ctrl+A → Ctrl+C in that tab).",
        );
      }
      try {
        JSON.parse(trimmed);
      } catch {
        throw new Error(
          "Clipboard isn't valid JSON. Re-copy the JSON page body and try again.",
        );
      }

      // 1. Create a fresh import row (provider=MYSCOREIQ).
      const create = await fetch("/api/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cj = await create.json();
      if (!create.ok) {
        throw new Error(cj.message ?? cj.error ?? "Could not start import.");
      }
      const importId = cj.import.id as string;

      // 2. Capture the pasted body.
      const paste = await fetch(`/api/reports/import/${importId}/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: trimmed }),
      });
      const pj = await paste.json();
      if (!paste.ok) {
        throw new Error(pj.message ?? pj.error ?? "Could not save report.");
      }

      // 3. Normalize.
      const norm = await fetch(`/api/reports/import/${importId}/normalize`, {
        method: "POST",
      });
      const nj = await norm.json();
      if (!norm.ok) {
        throw new Error(nj.message ?? nj.error ?? "Could not parse report.");
      }

      setStatus("connected");
      setResultMsg(
        `Report connected successfully — ${nj.tradelineCount} tradelines, ${nj.candidatesCreated} dispute candidates detected.`,
      );
      router.refresh();
    } catch (err) {
      setClipErr((err as Error).message);
    } finally {
      setClipBusy(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // STATE: connected
  if (status === "connected") {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <span className="text-lg">✓</span>
          <h3 className="text-base font-semibold">Report connected successfully</h3>
        </div>
        <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">
          {resultMsg}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/dashboard/reports"
            className="rounded-2xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Review Report →
          </a>
          <a
            href="/dashboard"
            className="rounded-2xl border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-fg hover:bg-surface-muted"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // STATE: needs_login (server fetch failed because MyScoreIQ wants a
  // browser session — three-step guided flow ending in clipboard auto-import)
  if (status === "needs_login" && needsLoginInfo) {
    return (
      <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <span className="text-lg">⚠</span>
          <h3 className="text-base font-semibold">
            Log in to MyScoreIQ to continue
          </h3>
        </div>
        <p className="mt-2 text-sm text-amber-900/85 dark:text-amber-200/85">
          MyScoreIQ&apos;s report is gated by a browser session our server
          can&apos;t see. Three quick steps and you&apos;re in:
        </p>

        {/* STEP 1 — sign in to MyScoreIQ */}
        <div className="mt-5 rounded-2xl border border-amber-200 bg-white/60 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Step 1
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Sign in to MyScoreIQ
          </p>
          <p className="mt-1 text-xs text-amber-900/75 dark:text-amber-200/75">
            Skip this if you&apos;re already signed in.
          </p>
          <button
            type="button"
            onClick={openMyScoreIQ}
            className="mt-2 rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
          >
            Open MyScoreIQ ↗
          </button>
        </div>

        {/* STEP 2 — open JSON tab + copy */}
        <div className="mt-3 rounded-2xl border border-amber-200 bg-white/60 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Step 2
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Open the JSON tab and copy the page
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900/75 dark:text-amber-200/75">
            We&apos;ll open your report JSON in a new tab. Inside that tab:
            press <kbd className="rounded border border-amber-300 bg-amber-100 px-1 font-mono text-[10px] dark:border-amber-500/30 dark:bg-amber-950/40">Ctrl+A</kbd>{" "}
            then{" "}
            <kbd className="rounded border border-amber-300 bg-amber-100 px-1 font-mono text-[10px] dark:border-amber-500/30 dark:bg-amber-950/40">Ctrl+C</kbd>
            , then come back here. (On Mac use{" "}
            <kbd className="rounded border border-amber-300 bg-amber-100 px-1 font-mono text-[10px] dark:border-amber-500/30 dark:bg-amber-950/40">⌘A</kbd>
            {" "}/{" "}
            <kbd className="rounded border border-amber-300 bg-amber-100 px-1 font-mono text-[10px] dark:border-amber-500/30 dark:bg-amber-950/40">⌘C</kbd>
            .)
          </p>
          <button
            type="button"
            onClick={openJsonTab}
            className="mt-2 rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
          >
            Open JSON Tab ↗
          </button>
        </div>

        {/* STEP 3 — clipboard auto-import (the magic) */}
        <div
          className={`mt-3 rounded-2xl border p-4 transition ${
            jsonTabOpened
              ? "border-amber-500 bg-amber-100/70 dark:border-amber-400/50 dark:bg-amber-500/10"
              : "border-amber-200 bg-white/60 dark:border-amber-500/20 dark:bg-amber-950/20"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Step 3
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Auto-Import from Clipboard
          </p>
          <p className="mt-1 text-xs text-amber-900/75 dark:text-amber-200/75">
            We&apos;ll read your copied JSON, normalize the report, and drop
            you on a connected dashboard. Your browser may ask for clipboard
            permission the first time.
          </p>
          <button
            type="button"
            onClick={importFromClipboard}
            disabled={clipBusy}
            className="mt-3 rounded-2xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {clipBusy ? "Importing from clipboard…" : "Auto-Import from Clipboard"}
          </button>
          {clipErr && (
            <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {clipErr}
            </p>
          )}
          {clipMsg && (
            <p className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] leading-5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              {clipMsg}
            </p>
          )}
        </div>

        {/* Retry server-side fetch — secondary action */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-amber-900/70 dark:text-amber-200/70">
            Or try the server fetch again:
          </span>
          <button
            type="button"
            onClick={retryConnect}
            className="rounded-xl border border-amber-400 bg-transparent px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/10"
          >
            Retry server fetch
          </button>
          {retryAttempts >= 1 && (
            <span className="text-[11px] text-amber-800/70 dark:text-amber-200/60">
              ({retryAttempts} attempt{retryAttempts === 1 ? "" : "s"} —
              clipboard import is faster)
            </span>
          )}
        </div>

        <FallbackOptions
          jsonReportUrl={jsonReportUrl}
          retryImportId={retryImportId}
          show={showFallback}
          onToggle={() => setShowFallback((v) => !v)}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // STATE: failed
  if (status === "failed") {
    return (
      <div className="rounded-3xl border border-rose-300 bg-rose-50 p-6 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <span className="text-lg">✕</span>
          <h3 className="text-base font-semibold">Connect failed</h3>
        </div>
        <p className="mt-2 text-sm text-rose-900/85 dark:text-rose-200/85">
          {errorMsg}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={connect}
            className="rounded-2xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Try Again
          </button>
        </div>
        <FallbackOptions
          jsonReportUrl={jsonReportUrl}
          retryImportId={retryImportId}
          show={showFallback}
          onToggle={() => setShowFallback((v) => !v)}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // STATE: idle / loading
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
          One-click import
        </p>
        <h3 className="mt-1 text-lg font-semibold text-fg">
          Connect your MyScoreIQ report
        </h3>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          DisputeIQ pulls your 3-bureau MyScoreIQ JSON directly into your
          workspace. No paste, no upload — just one click.
        </p>
      </div>

      <button
        type="button"
        onClick={connect}
        disabled={status === "loading"}
        className="mt-5 w-full rounded-2xl bg-fg px-5 py-3.5 text-sm font-semibold text-canvas transition hover:opacity-90 disabled:opacity-60"
      >
        {status === "loading" ? "Connecting to MyScoreIQ…" : "Connect MyScoreIQ Report"}
      </button>

      <p className="mt-3 text-[11px] leading-5 text-fg-subtle">
        Make sure you&apos;re signed in to MyScoreIQ in this browser. If we
        can&apos;t reach your report we&apos;ll guide you through a one-step
        login + retry.
      </p>

      <FallbackOptions
        jsonReportUrl={jsonReportUrl}
        retryImportId={retryImportId}
        show={showFallback}
        onToggle={() => setShowFallback((v) => !v)}
      />
    </div>
  );
}

// ─── Fallback options (collapsed by default) ──────────────────────────────

function FallbackOptions({
  jsonReportUrl,
  retryImportId,
  show,
  onToggle,
}: {
  jsonReportUrl: string;
  retryImportId?: string | null;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-semibold text-fg-muted hover:text-fg"
      >
        {show ? "Hide manual options ▲" : "More options (manual upload / paste / retry) ▼"}
      </button>
      {show && (
        <div className="mt-4 space-y-4">
          {retryImportId ? (
            <RetryImport importId={retryImportId} />
          ) : null}
          <UploadJson />
          <PasteJson />
          <p className="rounded-xl border border-border bg-surface-muted p-3 text-[11px] leading-5 text-fg-subtle">
            Auto-connect (URL + cookie) is available for support — admins
            paste a session cookie to fetch on your behalf. Customer flow is
            the one-click button above; these inputs are emergency
            fallbacks only.
          </p>
          <AutoConnectAdvanced jsonReportUrl={jsonReportUrl} />
        </div>
      )}
    </div>
  );
}

function RetryImport({ importId }: { importId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/reports/import/${importId}/normalize`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "RETRY_FAILED");
      setMsg(
        `Retry succeeded — ${json.tradelineCount} tradelines, ${json.candidatesCreated} dispute candidates.`,
      );
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
        Retry last failed import
      </p>
      <p className="mt-1 text-[11px] text-rose-900/80 dark:text-rose-200/80">
        Re-runs normalization against the already-captured raw payload — no
        re-paste needed.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="mt-2 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Retrying…" : "Retry Import"}
      </button>
      {msg && (
        <p className="mt-2 text-[11px] text-rose-900/85 dark:text-rose-200/85">
          {msg}
        </p>
      )}
    </div>
  );
}

function UploadJson() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const create = await fetch("/api/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cj = await create.json();
      if (!create.ok) throw new Error(cj.message ?? cj.error ?? "CREATE_FAILED");
      const importId = cj.import.id;

      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`/api/reports/import/${importId}/upload`, {
        method: "POST",
        body: fd,
      });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.message ?? upJson.error ?? "UPLOAD_FAILED");

      const norm = await fetch(`/api/reports/import/${importId}/normalize`, {
        method: "POST",
      });
      const normJson = await norm.json();
      if (!norm.ok) throw new Error(normJson.message ?? normJson.error ?? "NORMALIZE_FAILED");

      setMsg(
        `Imported — ${normJson.tradelineCount} tradelines, ${normJson.candidatesCreated} dispute candidates.`,
      );
      setFile(null);
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3">
      <p className="text-xs font-semibold text-fg-muted">Upload JSON file</p>
      <input
        type="file"
        accept="application/json,.json"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-1 block w-full text-xs"
      />
      {file && (
        <p className="mt-1 text-[11px] text-fg-muted">
          {file.name} · {(file.size / 1024).toFixed(1)} KB
        </p>
      )}
      <button
        type="button"
        disabled={busy || !file}
        onClick={go}
        className="mt-2 rounded-xl bg-fg px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload & import"}
      </button>
      {msg && <p className="mt-2 text-[11px] text-fg-muted">{msg}</p>}
    </div>
  );
}

function PasteJson() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    if (!body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const create = await fetch("/api/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const cj = await create.json();
      if (!create.ok) throw new Error(cj.message ?? cj.error ?? "CREATE_FAILED");
      const importId = cj.import.id;

      const paste = await fetch(`/api/reports/import/${importId}/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: body }),
      });
      const pj = await paste.json();
      if (!paste.ok) throw new Error(pj.message ?? pj.error ?? "PASTE_FAILED");

      const norm = await fetch(`/api/reports/import/${importId}/normalize`, {
        method: "POST",
      });
      const normJson = await norm.json();
      if (!norm.ok) throw new Error(normJson.message ?? normJson.error ?? "NORMALIZE_FAILED");

      setMsg(
        `Imported — ${normJson.tradelineCount} tradelines, ${normJson.candidatesCreated} dispute candidates.`,
      );
      setBody("");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3">
      <p className="text-xs font-semibold text-fg-muted">Paste JSON body</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder='{"borrower": {...}, "tradelines": [...]}'
        className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 font-mono text-[11px]"
      />
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={go}
        className="mt-2 rounded-xl bg-fg px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import pasted JSON"}
      </button>
      {msg && <p className="mt-2 text-[11px] text-fg-muted">{msg}</p>}
    </div>
  );
}

// Auto-connect with URL + cookie — visible in fallback options for admins or
// power users who have captured a MyScoreIQ session cookie. Not the primary
// flow.
function AutoConnectAdvanced({ jsonReportUrl }: { jsonReportUrl: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(jsonReportUrl);
  const [cookie, setCookie] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    if (!cookie.trim()) {
      setMsg("Paste a MyScoreIQ session cookie first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const create = await fetch("/api/reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      const cj = await create.json();
      if (!create.ok) throw new Error(cj.message ?? cj.error ?? "CREATE_FAILED");
      const importId = cj.import.id;

      const fetchRes = await fetch(`/api/reports/import/${importId}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, cookieHeader: cookie }),
      });
      const fj = await fetchRes.json();
      if (!fetchRes.ok) throw new Error(fj.message ?? fj.error ?? "FETCH_FAILED");

      const norm = await fetch(`/api/reports/import/${importId}/normalize`, {
        method: "POST",
      });
      const nj = await norm.json();
      if (!norm.ok) throw new Error(nj.message ?? nj.error ?? "NORMALIZE_FAILED");

      setMsg(
        `Imported — ${nj.tradelineCount} tradelines, ${nj.candidatesCreated} dispute candidates.`,
      );
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-semibold text-fg-muted hover:text-fg"
      >
        {open ? "Hide advanced (URL + cookie)" : "Advanced — auto-connect with session cookie"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="block w-full rounded-lg border border-border-strong bg-surface px-2 py-1 font-mono text-[11px]"
          />
          <textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            rows={3}
            placeholder="ASP.NET_SessionId=...; other=..."
            className="block w-full rounded-lg border border-border-strong bg-surface px-2 py-1 font-mono text-[11px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={go}
            className="rounded-xl bg-fg px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Fetch with cookie"}
          </button>
          {msg && <p className="text-[11px] text-fg-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
