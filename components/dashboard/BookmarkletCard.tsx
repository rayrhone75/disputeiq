// One-click MyScoreIQ import via browser bookmarklet.
//
// The card renders three components:
//   1. A draggable anchor whose href is the user's personalized
//      `javascript:` bookmarklet. Browsers let users drag this directly
//      to their bookmarks bar, which is the install path.
//   2. A button that opens the MyScoreIQ JSON report URL in a new tab.
//   3. Helpful copy buttons (clipboard fallback, "I imported my report"
//      refresh).
//
// The token is signed server-side (HMAC over INTERNAL_SERVICE_SECRET)
// during render and baked into the bookmarklet code. Token TTL is 30
// days; users get a fresh token every time the page renders.

import { signBookmarkletToken } from "@/lib/auth/bookmarklet-token";
import { BookmarkletInstallControls } from "./BookmarkletInstallControls";

const DEFAULT_JSON_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

function buildBookmarkletCode(opts: {
  relayUrl: string;
}): string {
  // Bookmarklet pattern: open the DisputeIQ relay tab, then postMessage the
  // JSON to it once the relay signals "ready". The relay is a Clerk-authed
  // page on disputeiq.org, so the actual import POST happens same-origin
  // with full Clerk session — no CORS, no service-secret coupling.
  //
  // Why this dance instead of a direct fetch:
  //   - member.myscoreiq.com has no Clerk session cookies, so a direct POST
  //     to disputeiq.org cannot authenticate against Convex.
  //   - The relay page on disputeiq.org has the user's Clerk session, can
  //     mint a Convex JWT, and runs the existing import pipeline that
  //     already works against the deployed Convex schema.
  //
  // The bookmarklet retries postMessage every 750ms for 30s so a sign-in
  // redirect mid-flow doesn't lose the JSON (the relay re-sends "ready"
  // after sign-in remount).
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

export function BookmarkletCard({ clerkUserId }: { clerkUserId: string }) {
  const appBaseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://disputeiq.org";
  const jsonUrl = process.env.MYSCOREIQ_JSON_REPORT_URL ?? DEFAULT_JSON_URL;

  let bookmarkletHref = "";
  let signError: string | null = null;
  try {
    const token = signBookmarkletToken(clerkUserId);
    const relayUrl = `${appBaseUrl}/import/relay?t=${encodeURIComponent(token)}`;
    bookmarkletHref = buildBookmarkletCode({ relayUrl });
  } catch (err) {
    signError = (err as Error).message;
  }

  if (signError) {
    return (
      <div className="rounded-3xl border border-rose-300 bg-rose-50 p-6 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          One-click browser import
        </p>
        <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">
          The bookmarklet feature requires the server-side service secret
          to be configured. Reach out to support — this is a setup issue,
          not your account.
        </p>
        <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
          {signError}
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
                // Prevent accidental navigation to the bookmarklet on
                // click — they should drag, not click. Right-click → Add
                // to bookmarks also works.
                e.preventDefault();
              }}
              className="inline-flex select-none items-center gap-2 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas shadow-sm hover:opacity-90"
              title="Drag this to your bookmarks bar"
            >
              📑 DisputeIQ Import
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

      <BookmarkletInstallControls bookmarkletHref={bookmarkletHref} />

      <p className="mt-5 border-t border-violet-200/60 pt-4 text-[11px] leading-relaxed text-fg-subtle dark:border-violet-500/20">
        Privacy: the bookmarklet never sees your MyScoreIQ password. It
        reads the JSON your authenticated browser already loaded and POSTs
        it to DisputeIQ over HTTPS, signed with a token unique to your
        account. Token expires in 30 days; reload this page to refresh.
      </p>
    </div>
  );
}
