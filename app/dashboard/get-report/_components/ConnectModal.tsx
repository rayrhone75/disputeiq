"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RawConnectorAnchor } from "./RawConnectorAnchor";

// MyScoreIQ Auto-Connect modal.
//
// Two phases inside one modal — chosen automatically based on whether
// the user has already installed the Secure Connector on this device.
//
//   1. Setup (first-time): drag the Secure Connector to the bookmarks
//      bar. Animated, friendly. The user marks it installed when done.
//   2. Connect: open MyScoreIQ in a new tab. They sign in there. The
//      Secure Connector handles the import handoff automatically.
//
// We never use the words "bookmarklet" or "JSON" in customer-facing
// copy. The technical mechanism is unchanged from the prior session
// (HMAC-signed connector token + relay tab + postMessage handoff) —
// only the language and presentation change.

const INSTALLED_KEY = "diq.secureConnector.installed.v1";
const MSIQ_LOGIN_URL = "https://member.myscoreiq.com/login.aspx";
const MSIQ_REPORT_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

type Phase = "setup" | "connect" | "tab_opened";

export function ConnectModal({
  open,
  onClose,
  onContinueAnyway,
}: {
  open: boolean;
  onClose: () => void;
  onContinueAnyway: () => void;
}) {
  const [installed, setInstalled] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Hydrate install state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const flag = window.localStorage.getItem(INSTALLED_KEY);
      const isInstalled = flag === "1";
      setInstalled(isInstalled);
      setPhase(isInstalled ? "connect" : "setup");
    } catch {
      // ignore
    }
  }, [open]);

  // Fetch token when the modal opens. Always refresh — tokens are
  // 30-day TTL but cheap to mint, and we want the connector to carry
  // the freshest binding.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bookmarklet/token", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          token?: string;
          message?: string;
        };
        if (cancelled) return;
        if (data.ok && data.token) {
          setToken(data.token);
          setTokenError(null);
        } else {
          setTokenError(
            data.message ?? "Could not prepare the Secure Connector.",
          );
        }
      } catch (err) {
        if (cancelled) return;
        setTokenError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Esc + outside-click to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const markInstalled = useCallback(() => {
    try {
      window.localStorage.setItem(INSTALLED_KEY, "1");
    } catch {
      // ignore
    }
    setInstalled(true);
    setPhase("connect");
  }, []);

  const connectorHref = token
    ? buildConnectorHref(token, currentOrigin())
    : "javascript:void(0)";

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(connectorHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  }

  function openMyScoreIQ() {
    // Open MyScoreIQ login in a new tab. Customer signs in; their
    // authenticated session loads the report; they tap the Secure
    // Connector on their bookmarks bar; the relay tab catches the
    // import.
    window.open(MSIQ_LOGIN_URL, "_blank", "noopener,noreferrer");
    setPhase("tab_opened");
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-surface shadow-[0_40px_100px_-30px_rgba(15,23,42,0.7)]"
      >
        {/* Header gradient stripe */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 px-6 py-5 text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                MyScoreIQ · Auto-Connect
              </p>
              <h2
                id="connect-modal-title"
                className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl"
              >
                {phase === "setup"
                  ? "Set up your Secure Connector"
                  : phase === "tab_opened"
                    ? "Sign in on MyScoreIQ"
                    : "Connect MyScoreIQ"}
              </h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-white/85">
                {phase === "setup"
                  ? "One-time setup. Saves to your browser bookmarks bar — never to DisputeIQ."
                  : phase === "tab_opened"
                    ? "We opened MyScoreIQ in a new tab. Sign in there, then tap the Secure Connector on your bookmarks bar."
                    : "We never see or store your MyScoreIQ password. Your authenticated browser does the work."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full bg-white/15 p-2 text-white/90 ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          {tokenError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {tokenError} You can still use the manual upload fallback below.
            </div>
          )}

          {phase === "setup" && (
            <SetupStep
              connectorHref={connectorHref}
              tokenReady={!!token}
              copied={copied}
              onCopy={copy}
              onMarkInstalled={markInstalled}
            />
          )}

          {phase === "connect" && (
            <ConnectStep
              connectorHref={connectorHref}
              tokenReady={!!token}
              installed={installed}
              onOpenMyScoreIQ={openMyScoreIQ}
              onReinstall={() => setPhase("setup")}
            />
          )}

          {phase === "tab_opened" && (
            <TabOpenedStep
              onContinueAnyway={onContinueAnyway}
              onClose={onClose}
              onOpenAgain={openMyScoreIQ}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-surface-muted/40 px-6 py-4 sm:px-8">
          <p className="flex items-start gap-2 text-[11px] leading-5 text-fg-muted">
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
              fill="currentColor"
            >
              <path d="M8 1l6 2.6V8c0 4-2.6 6.6-6 7.4C4.6 14.6 2 12 2 8V3.6L8 1z" />
            </svg>
            <span>
              Bank-level encryption. We never see or store your MyScoreIQ
              password. The Secure Connector reads only what your
              authenticated browser already has.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function SetupStep({
  connectorHref,
  tokenReady,
  copied,
  onCopy,
  onMarkInstalled,
}: {
  connectorHref: string;
  tokenReady: boolean;
  copied: boolean;
  onCopy: () => void;
  onMarkInstalled: () => void;
}) {
  return (
    <div className="space-y-5">
      <ol className="space-y-3 text-sm text-fg">
        <Step
          n="1"
          title="Open your bookmarks bar"
          body={
            <>
              Press{" "}
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">
                Ctrl + Shift + B
              </kbd>{" "}
              (Windows) or{" "}
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">
                ⌘ + Shift + B
              </kbd>{" "}
              (Mac) if it&apos;s hidden.
            </>
          }
        />
        <Step
          n="2"
          title="Drag the button below to that bar"
          body="Saves to your browser. Nothing leaves your computer."
        />
      </ol>

      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 text-center dark:border-violet-500/30 dark:from-violet-500/15 dark:to-indigo-500/10">
        {tokenReady ? (
          <RawConnectorAnchor
            href={connectorHref}
            className="inline-flex select-none items-center gap-2 rounded-xl bg-fg px-6 py-3.5 text-sm font-semibold text-canvas shadow-[0_18px_48px_-18px_rgba(99,102,241,0.55)] transition hover:-translate-y-0.5 no-underline"
            label="📑 DisputeIQ Secure Connector"
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-progress select-none items-center gap-2 rounded-xl bg-surface-muted px-6 py-3.5 text-sm font-semibold text-fg-subtle"
          >
            Preparing connector…
          </button>
        )}
        <p className="mt-3 text-[11px] leading-5 text-fg-muted">
          ↑ Drag this button up to your bookmarks bar
        </p>
      </div>

      <details className="group rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer list-none font-semibold text-fg-muted hover:text-fg">
          <span className="inline-flex items-center gap-2">
            Can&apos;t drag?
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 transition group-open:rotate-180"
              fill="none"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </summary>
        <p className="mt-2 text-xs leading-5 text-fg-muted">
          Click the button below to copy the Connector. Then in your
          browser: bookmark this page, edit the bookmark, and paste the
          copied text into the URL field.
        </p>
        <button
          type="button"
          onClick={onCopy}
          disabled={!tokenReady}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[11px] font-semibold text-fg hover:bg-surface-muted disabled:opacity-50"
        >
          {copied ? "Copied ✓" : "Copy Connector"}
        </button>
      </details>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onMarkInstalled}
          disabled={!tokenReady}
          className="inline-flex items-center gap-2 rounded-2xl bg-fg px-5 py-3 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
        >
          I added it to my bookmarks
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ConnectStep({
  connectorHref,
  tokenReady,
  installed,
  onOpenMyScoreIQ,
  onReinstall,
}: {
  connectorHref: string;
  tokenReady: boolean;
  installed: boolean;
  onOpenMyScoreIQ: () => void;
  onReinstall: () => void;
}) {
  return (
    <div className="space-y-5">
      {installed && (
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Secure Connector installed
        </div>
      )}

      <ol className="space-y-3 text-sm text-fg">
        <Step
          n="1"
          title="Open MyScoreIQ"
          body="We'll open it in a new tab. You'll sign in there — your password never touches DisputeIQ."
        />
        <Step
          n="2"
          title="Tap the Secure Connector"
          body="Once your report loads on MyScoreIQ, click the Connector on your bookmarks bar. We'll handle the rest."
        />
        <Step
          n="3"
          title="You're done"
          body="Come back here — your dashboard updates the moment your report lands."
        />
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onReinstall}
          className="text-xs font-semibold text-fg-muted hover:text-fg"
        >
          Reinstall Connector
        </button>
        <button
          type="button"
          onClick={onOpenMyScoreIQ}
          disabled={!tokenReady}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-4 text-base font-semibold text-white shadow-[0_18px_48px_-18px_rgba(99,102,241,0.55)] transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          Open MyScoreIQ
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path
              d="M11 3h2v2m0-2L7 9M9 4H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Visible drag handle for repeat-installs from the Connect phase
          (e.g. bookmark got deleted). Uses RawConnectorAnchor to bypass
          React 19's javascript: URL sanitization. */}
      {tokenReady && (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-3 text-center text-[11px]">
          <p className="text-fg-muted">
            Need to reinstall the connector? Drag this:
          </p>
          <div className="mt-2">
            <RawConnectorAnchor
              href={connectorHref}
              className="inline-flex select-none items-center gap-2 rounded-lg bg-fg px-3 py-1.5 text-[11px] font-semibold text-canvas no-underline"
              label="📑 DisputeIQ Secure Connector"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TabOpenedStep({
  onContinueAnyway,
  onClose,
  onOpenAgain,
}: {
  onContinueAnyway: () => void;
  onClose: () => void;
  onOpenAgain: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-5 ring-1 ring-emerald-200 dark:from-emerald-500/15 dark:to-teal-500/10 dark:ring-emerald-500/30">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
          Next on MyScoreIQ
        </p>
        <ol className="mt-3 space-y-2 text-sm text-fg">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              1
            </span>
            Sign in to your MyScoreIQ account.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              2
            </span>
            Wait for your credit report to load.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              3
            </span>
            Tap the{" "}
            <span className="font-semibold">DisputeIQ Secure Connector</span>{" "}
            on your bookmarks bar.
          </li>
        </ol>
      </div>

      <p className="text-xs leading-5 text-fg-muted">
        We&apos;re watching for your report on this page — when it lands,
        we&apos;ll start your analysis automatically.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onOpenAgain}
          className="text-xs font-semibold text-fg-muted hover:text-fg"
        >
          Reopen MyScoreIQ
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onContinueAnyway}
            className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
          >
            I already imported
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg text-canvas text-xs font-bold">
        {n}
      </span>
      <div>
        <div className="font-semibold text-fg">{title}</div>
        <div className="mt-0.5 text-[12px] leading-5 text-fg-muted">{body}</div>
      </div>
    </li>
  );
}

function buildConnectorHref(token: string, appOrigin: string): string {
  const relayUrl = `${appOrigin}/import/relay?t=${encodeURIComponent(token)}`;
  // Customer-facing connector code. Same wire-level mechanism as before
  // (postMessage handshake with the relay tab) — only the language and
  // alert copy changes. No "JSON", no "bookmarklet" wording.
  const code =
    "(function(){try{" +
    "var b=document.body.innerText.trim();" +
    "if(b[0]!=='{'&&b[0]!=='['){return alert('DisputeIQ Connector: open your MyScoreIQ credit report first, then tap me.');}" +
    "var s=document.createElement('div');" +
    "s.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;background:#0a0f1c;color:#fff;padding:14px 18px;border-radius:12px;font:14px/1.45 system-ui;box-shadow:0 12px 40px rgba(0,0,0,.4);max-width:320px';" +
    "s.textContent='DisputeIQ: connecting your report\\u2026';" +
    "document.body.appendChild(s);" +
    "var relay=" + JSON.stringify(relayUrl) + ";" +
    "var relayOrigin=new URL(relay).origin;" +
    "var w=window.open(relay,'_blank');" +
    "if(!w){s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>Your browser blocked the popup. Allow pop-ups for this site and try again.';s.style.background='#7f1d1d';return;}" +
    "var sent=false;" +
    "function onMsg(ev){if(ev.origin!==relayOrigin)return;var d=ev.data;if(d&&d.k==='DIQ_READY'){try{w.postMessage({k:'DIQ_DATA',j:b},relayOrigin);sent=true;s.innerHTML='<strong>DisputeIQ \\u2713</strong><br>Connected. Watch the new tab for your analysis.';s.style.background='#064e3b';}catch(e){}}}" +
    "window.addEventListener('message',onMsg);" +
    "var tries=0;" +
    "var iv=setInterval(function(){tries++;if(sent||tries>40||!w||w.closed){clearInterval(iv);if(!sent&&!w.closed){s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>The DisputeIQ tab did not respond. Check that you are signed in and try again.';s.style.background='#7f1d1d';}return;}try{w.postMessage({k:'DIQ_PING'},relayOrigin);}catch(e){}},750);" +
    "setTimeout(function(){window.removeEventListener('message',onMsg);},90000);" +
    "}catch(e){alert('DisputeIQ Connector error: '+e.message);}})();";
  return "javascript:" + encodeURI(code);
}

function currentOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://disputeiq.org";
}
