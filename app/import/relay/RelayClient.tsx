"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Client-side handshake component for the bookmarklet relay.
//
// Lifecycle:
//   1. On mount: postMessage `{k:"DIQ_READY"}` to window.opener targeting
//      the configured MyScoreIQ origin. Repeat every 1s for 30s in case the
//      bookmarklet's listener attached after a sign-in redirect.
//   2. Listen for `{k:"DIQ_DATA", j:<jsonText>}` postMessages. Origin must
//      match an allowed MSIQ origin. First valid message is captured.
//   3. POST {token, json} to /api/reports/import/bookmarklet (same origin →
//      Clerk session cookie + Convex JWT travel naturally).
//   4. On success: router.push to redirect target.
//   5. On no message within 60s: surface a manual paste textarea so the
//      user can finish the import even if postMessage failed.

const ALLOWED_ORIGINS = [
  "https://member.myscoreiq.com",
  "https://www.myscoreiq.com",
  "https://myscoreiq.com",
];

type Phase =
  | "waiting"
  | "received"
  | "uploading"
  | "done"
  | "error"
  | "token_invalid"
  | "uid_mismatch";

export function RelayClient({
  token,
  tokenOk,
  tokenError,
  tokenUidMatches,
  userEmail,
}: {
  token: string;
  tokenOk: boolean;
  tokenError: string | null;
  tokenUidMatches: boolean;
  userEmail: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => {
    if (!tokenOk) return "token_invalid";
    if (!tokenUidMatches) return "uid_mismatch";
    return "waiting";
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tradelineCount, setTradelineCount] = useState<number | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const submittedRef = useRef(false);

  const submit = useCallback(
    async (json: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("uploading");
      try {
        const res = await fetch("/api/reports/import/bookmarklet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, json }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          tradelineCount?: number;
          redirect?: string;
          message?: string;
          code?: string;
        };
        if (res.ok && data.ok) {
          setTradelineCount(data.tradelineCount ?? null);
          setPhase("done");
          const target = data.redirect ?? "/dashboard/get-report?imported=1";
          // Brief pause so user sees the success badge.
          setTimeout(() => router.push(target), 1200);
          return;
        }
        setErrorMsg(data.message ?? `Import failed (${data.code ?? res.status}).`);
        setPhase("error");
      } catch (err) {
        setErrorMsg((err as Error).message);
        setPhase("error");
      }
    },
    [router, token],
  );

  // Phase 1: postMessage handshake.
  useEffect(() => {
    if (phase !== "waiting") return;
    if (!window.opener) {
      // Tab was opened directly (no opener) — go straight to manual paste.
      setShowFallback(true);
      return;
    }

    function broadcastReady() {
      for (const origin of ALLOWED_ORIGINS) {
        try {
          window.opener?.postMessage({ k: "DIQ_READY" }, origin);
        } catch {
          // postMessage to a closed window throws; ignore.
        }
      }
    }

    function onMessage(ev: MessageEvent) {
      if (!ALLOWED_ORIGINS.includes(ev.origin)) return;
      const data = ev.data as { k?: string; j?: unknown } | null;
      if (!data || data.k !== "DIQ_DATA" || typeof data.j !== "string") return;
      setPhase("received");
      void submit(data.j);
    }

    window.addEventListener("message", onMessage);
    broadcastReady();
    const interval = window.setInterval(broadcastReady, 1000);
    const fallbackTimer = window.setTimeout(() => setShowFallback(true), 60_000);
    const stopBroadcast = window.setTimeout(
      () => window.clearInterval(interval),
      30_000,
    );

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(interval);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(stopBroadcast);
    };
  }, [phase, submit]);

  function handleManualSubmit() {
    const trimmed = pasteValue.trim();
    if (!trimmed) {
      setErrorMsg("Paste your MyScoreIQ JSON above first.");
      setPhase("error");
      return;
    }
    if (trimmed[0] !== "{" && trimmed[0] !== "[") {
      setErrorMsg("That doesn't look like JSON — it should start with { or [.");
      setPhase("error");
      return;
    }
    setErrorMsg(null);
    setPhase("received");
    void submit(trimmed);
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-8 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
        DisputeIQ · MyScoreIQ Import
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-fg">
        {phase === "done"
          ? "Imported"
          : phase === "uploading"
            ? "Importing your report…"
            : phase === "received"
              ? "Got it — uploading…"
              : phase === "error"
                ? "Import failed"
                : phase === "token_invalid"
                  ? "Bookmarklet expired or invalid"
                  : phase === "uid_mismatch"
                    ? "Wrong DisputeIQ account"
                    : "Connecting to MyScoreIQ tab…"}
      </h1>

      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Signed in as <span className="font-medium text-fg">{userEmail}</span>.
      </p>

      <StatusPill phase={phase} />

      {phase === "token_invalid" && (
        <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
          {tokenError ?? "This bookmarklet is no longer valid."}{" "}
          <a className="underline" href="/dashboard/get-report">
            Reload the bookmarklet card
          </a>{" "}
          on your dashboard to install a fresh one.
        </p>
      )}

      {phase === "uid_mismatch" && (
        <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
          This bookmarklet was created for a different DisputeIQ account.
          Sign out and back in as the correct user, or reinstall the
          bookmarklet from{" "}
          <a className="underline" href="/dashboard/get-report">
            /dashboard/get-report
          </a>
          .
        </p>
      )}

      {phase === "done" && (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
          Imported{" "}
          <span className="font-semibold">{tradelineCount ?? "your"}</span>{" "}
          tradelines. Redirecting…
        </p>
      )}

      {phase === "error" && (
        <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
          {errorMsg ?? "Something went wrong."}
        </p>
      )}

      {phase === "waiting" && !showFallback && (
        <p className="mt-4 text-sm text-fg-muted">
          Keep the MyScoreIQ tab open. We&apos;re asking it to send the JSON
          to this page. This usually takes a second or two.
        </p>
      )}

      {tokenOk && tokenUidMatches && showFallback && phase !== "done" && (
        <div className="mt-6 rounded-2xl border border-border-strong bg-surface-muted p-4">
          <p className="text-sm font-semibold text-fg">
            Manual fallback
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            If the bookmarklet didn&apos;t hand off automatically, paste the
            JSON from your MyScoreIQ report below and submit.
          </p>
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="Paste MyScoreIQ JSON here…"
            rows={6}
            className="mt-3 w-full rounded-lg border border-border bg-canvas p-3 font-mono text-xs text-fg"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={phase === "uploading"}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {phase === "uploading" ? "Uploading…" : "Submit JSON"}
          </button>
        </div>
      )}

      <div className="mt-8 flex gap-3 text-xs">
        <a
          href="/dashboard/get-report"
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 font-semibold text-fg hover:bg-surface-muted"
        >
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  const variants: Record<
    Phase,
    { label: string; cls: string }
  > = {
    waiting: {
      label: "Waiting for MyScoreIQ tab",
      cls: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    },
    received: {
      label: "JSON received",
      cls: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
    },
    uploading: {
      label: "Uploading to DisputeIQ",
      cls: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
    },
    done: {
      label: "Imported ✓",
      cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
    },
    error: {
      label: "Failed",
      cls: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
    },
    token_invalid: {
      label: "Token invalid",
      cls: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
    },
    uid_mismatch: {
      label: "Account mismatch",
      cls: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
    },
  };
  const v = variants[phase];
  return (
    <span
      className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${v.cls}`}
    >
      {v.label}
    </span>
  );
}
