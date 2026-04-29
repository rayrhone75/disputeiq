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
  endpoint: string;
  token: string;
  appBaseUrl: string;
}): string {
  // Minified by hand for inline use as `javascript:` URL. The single-quote
  // string template here is intentional — the JS string itself contains
  // double quotes for HTML safety, and we URI-encode it before inserting
  // into an href.
  const code =
    "(function(){try{var b=document.body.innerText.trim();" +
    "if(b[0]!=='{'&&b[0]!=='[')return alert('DisputeIQ: not a JSON page. Open https://member.myscoreiq.com/CreditReport.aspx?view=json first.');" +
    "var s=document.createElement('div');" +
    "s.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;background:#0a0f1c;color:#fff;padding:14px 18px;border-radius:12px;font:14px/1.45 system-ui;box-shadow:0 12px 40px rgba(0,0,0,.4);max-width:320px';" +
    "s.textContent='DisputeIQ: importing your report\\u2026';" +
    "document.body.appendChild(s);" +
    "fetch('" + opts.endpoint + "?t=" + opts.token + "',{method:'POST',body:b,headers:{'Content-Type':'text/plain'}})" +
    ".then(function(r){return r.json();})" +
    ".then(function(d){" +
    "if(d&&d.ok){s.innerHTML='<strong>DisputeIQ \\u2713</strong><br>Imported '+d.tradelineCount+' tradelines. <a href=\"" +
    opts.appBaseUrl +
    "'+d.redirect+'\" style=\"color:#7dd3fc\">Open dashboard \\u2192</a>';s.style.background='#064e3b';}" +
    "else{s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>'+(d&&d.message?d.message:'Import failed.');s.style.background='#7f1d1d';}" +
    "})" +
    ".catch(function(e){s.innerHTML='<strong>DisputeIQ \\u2717</strong><br>Network error: '+e.message;s.style.background='#7f1d1d';});" +
    "}catch(e){alert('DisputeIQ bookmarklet error: '+e.message);}})();";
  return "javascript:" + encodeURI(code);
}

export function BookmarkletCard({ clerkUserId }: { clerkUserId: string }) {
  const appBaseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://disputeiq.org";
  const jsonUrl = process.env.MYSCOREIQ_JSON_REPORT_URL ?? DEFAULT_JSON_URL;
  const endpoint = `${appBaseUrl}/api/reports/import/bookmarklet`;

  let bookmarkletHref = "";
  let signError: string | null = null;
  try {
    const token = signBookmarkletToken(clerkUserId);
    bookmarkletHref = buildBookmarkletCode({
      endpoint,
      token,
      appBaseUrl,
    });
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
