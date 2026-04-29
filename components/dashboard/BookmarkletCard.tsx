"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// One-click MyScoreIQ import via browser bookmarklet (client-only).
//
// The bookmarklet token used to be HMAC-signed during server render and
// baked into the anchor href server-side. That coupled the dashboard
// render to INTERNAL_SERVICE_SECRET availability and any quirk in the
// signing path produced a generic Vercel "server component error" with
// no useful stack. The card is now a pure client component that fetches
// `{ token }` from /api/bookmarklet/token on mount; if the API fails
// the card surfaces the error inline instead of crashing the whole page.

const DEFAULT_JSON_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

type State =
  | { kind: "loading" }
  | { kind: "ready"; token: string }
  | { kind: "error"; message: string };

function buildBookmarkletCode(opts: { relayUrl: string }): string {
  const code =
    "(function(){try{" +
    "var b=document.body.innerText.trim();" +
    "if(b[0]!=='{'&&b[0]!=='[')return alert('DisputeIQ: not a JSON page. Open https://member.myscoreiq.com/CreditReport.aspx?view=json first, then click this bookmarklet.');" +
    "var s=document.createElement('div');" +
    "s.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;background:#0a0f1c;color:#fff;padding:14px 18px;border-radius:12px;font:14px/1.45 system-ui;box-shadow:0 12px 40px rgba(0,0,0,.4);max-width:320px';" +
    "s.textContent='DisputeIQ: opening importer\\u2026';" +
    "document.body.appendChild(s);" +
    "var relay='" + opts.relayUrl + "';" +
    "var relayOrigin=new URL(relay).origin;" +
    "var w=window.open(relay,'_blank');" +
    "if(!w){s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>Browser blocked the popup. Allow pop-ups for this site and try again.';s.style.background='#7f1d1d';return;}" +
    "var sent=false;" +
    "function onMsg(ev){if(ev.origin!==relayOrigin)return;var d=ev.data;if(d&&d.k==='DIQ_READY'){try{w.postMessage({k:'DIQ_DATA',j:b},relayOrigin);sent=true;s.innerHTML='<strong>DisputeIQ \\u2713</strong><br>Sent to DisputeIQ. Watch the new tab for progress.';s.style.background='#064e3b';}catch(e){}}}" +
    "window.addEventListener('message',onMsg);" +
    "var tries=0;" +
    "var iv=setInterval(function(){tries++;if(sent||tries>40||!w||w.closed){clearInterval(iv);if(!sent&&!w.closed){s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>The DisputeIQ tab did not respond. Check that you are signed in and try again.';s.style.background='#7f1d1d';}return;}try{w.postMessage({k:'DIQ_PING'},relayOrigin);}catch(e){}},750);" +
    "setTimeout(function(){window.removeEventListener('message',onMsg);},90000);" +
    "}catch(e){alert('DisputeIQ bookmarklet error: '+e.message);}})();";
  return "javascript:" + encodeURI(code);
}

function appBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://disputeiq.org";
}

export function BookmarkletCard() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);

  useEffect(() => {
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
          code?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.token) {
          setState({
            kind: "error",
            message:
              data.message ?? `Could not generate bookmarklet (${data.code ?? res.status}).`,
          });
          return;
        }
        setState({ kind: "ready", token: data.token });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jsonUrl = DEFAULT_JSON_URL;
  const bookmarkletHref =
    state.kind === "ready"
      ? buildBookmarkletCode({
          relayUrl: `${appBaseUrl()}/import/relay?t=${encodeURIComponent(state.token)}`,
        })
      : "javascript:void(0)";

  async function copy() {
    if (state.kind !== "ready") return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available in this browser.");
      }
      await navigator.clipboard.writeText(bookmarkletHref);
      setCopied(true);
      setCopyErr(null);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setCopyErr((err as Error).message);
    }
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-3xl border border-rose-300 bg-rose-50 p-6 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          One-click browser import
        </p>
        <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">
          We couldn&apos;t generate your bookmarklet right now. You can still
          import via the manual paste/upload panel above.
        </p>
        <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-violet-300 bg-violet-50/70 p-6 shadow-sm dark:border-violet-500/30 dark:bg-violet-500/10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
        One-click browser import
      </p>
      <h3 className="mt-1 text-lg font-semibold text-fg">
        Install the DisputeIQ bookmarklet
      </h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Install once. Then one click from your MyScoreIQ JSON page and your
        report imports automatically — no copy/paste, no password storage,
        no extension to install.
      </p>

      <ol className="mt-5 space-y-4 text-sm text-fg">
        <li>
          <p className="font-semibold">
            Step 1 · Drag the button below to your bookmarks bar
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Tip: if you don&apos;t see your bookmarks bar, press{" "}
            <kbd className="rounded border border-border bg-surface px-1 font-mono text-[10px]">
              Ctrl+Shift+B
            </kbd>{" "}
            (Windows) or{" "}
            <kbd className="rounded border border-border bg-surface px-1 font-mono text-[10px]">
              ⌘⇧B
            </kbd>{" "}
            (Mac) to show it.
          </p>
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional javascript: href */}
            <a
              href={bookmarkletHref}
              draggable
              onClick={(e) => {
                e.preventDefault();
              }}
              className={`inline-flex select-none items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm ${
                state.kind === "ready"
                  ? "bg-fg text-canvas hover:opacity-90"
                  : "cursor-progress bg-surface-muted text-fg-subtle"
              }`}
              title="Drag this to your bookmarks bar"
            >
              📑 DisputeIQ Import
              {state.kind === "loading" ? " (loading…)" : ""}
            </a>
          </div>
        </li>

        <li>
          <p className="font-semibold">Step 2 · Open your MyScoreIQ report</p>
          <p className="mt-1 text-xs text-fg-muted">
            Sign in to MyScoreIQ first if you haven&apos;t already. Then
            this opens your JSON report in a new tab.
          </p>
          <a
            href={jsonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-fg hover:bg-surface-muted"
          >
            Open MyScoreIQ Report ↗
          </a>
        </li>

        <li>
          <p className="font-semibold">
            Step 3 · Click the bookmarklet on the JSON page
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            From your bookmarks bar — the one you just dragged. A status
            overlay shows the import progress in the corner.
          </p>
        </li>

        <li>
          <p className="font-semibold">
            Step 4 · We&apos;ll redirect you back here automatically
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Or click the &quot;Open dashboard&quot; link in the success
            overlay.
          </p>
        </li>
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={state.kind !== "ready"}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted disabled:opacity-50"
          title="Copy the bookmarklet code if you can't drag it"
        >
          {copied ? "Copied ✓" : "Copy Bookmarklet"}
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
        >
          I imported my report
        </button>
        {copyErr && (
          <span className="text-[11px] text-rose-600 dark:text-rose-400">
            {copyErr}
          </span>
        )}
      </div>

      <p className="mt-5 border-t border-violet-200/60 pt-4 text-[11px] leading-relaxed text-fg-subtle dark:border-violet-500/20">
        Privacy: the bookmarklet never sees your MyScoreIQ password. It
        reads the JSON your authenticated browser already loaded and POSTs
        it to DisputeIQ over HTTPS, signed with a token unique to your
        account. Token expires in 30 days; reload this page to refresh.
      </p>
    </div>
  );
}
