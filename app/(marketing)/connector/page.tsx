import Link from "next/link";

// Public install page for the DisputeIQ Connector.
// One canonical URL we can share in support emails, the Web Store
// listing's homepage field, and the customer dashboard.
//
// The page reads NEXT_PUBLIC_CHROME_WEB_STORE_URL at build time. When
// it's set, the primary CTA links to the live Web Store listing; when
// not, the primary CTA downloads the signed ZIP and the page surfaces
// the manual "load unpacked" instructions.

export const metadata = {
  title: "Install the DisputeIQ Connector",
  description:
    "Install the DisputeIQ Connector for Chrome to import your MyScoreIQ credit report in one click.",
};

const ZIP_URL = "/downloads/disputeiq-connector-v0.1.0.zip";

export default function ConnectorPage() {
  const webStoreUrl = process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ?? null;
  const inReview = !webStoreUrl;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-fg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
        DisputeIQ Connector
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        Import your credit report in one click
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-fg-muted">
        A small Chrome extension that reads your MyScoreIQ tri-merge
        report and uploads it to your DisputeIQ workspace — no copy-paste,
        no password storage. Same pattern Client Dispute Manager, Dispute
        Panda, and Dispute Fox use, but built for DisputeIQ.
      </p>

      {/* Hero install card */}
      <section className="mt-10 overflow-hidden rounded-3xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-1 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.55)] dark:border-indigo-500/30 dark:from-indigo-500/15 dark:to-violet-500/10">
        <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-surface p-7 sm:p-9">
          <div className="flex flex-col items-start gap-5">
            {webStoreUrl ? (
              <a
                href={webStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-fg px-7 py-4 text-base font-semibold text-canvas shadow-[0_18px_48px_-12px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:opacity-95"
              >
                <ChromeGlyph />
                Add to Chrome
              </a>
            ) : (
              <a
                href={ZIP_URL}
                download
                className="inline-flex items-center gap-2 rounded-2xl bg-fg px-7 py-4 text-base font-semibold text-canvas shadow-[0_18px_48px_-12px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:opacity-95"
              >
                <DownloadGlyph />
                Download Connector (.zip)
              </a>
            )}
            <p className="text-[12px] text-fg-muted">
              {webStoreUrl
                ? "Works in Chrome, Edge, Brave, and other Chromium-based browsers."
                : `We're awaiting Chrome Web Store approval. For now, download the signed ZIP and load it as an unpacked extension — 30-second one-time install.`}
            </p>

            {inReview && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                Pending Web Store review
              </span>
            )}
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          What it does
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-fg-muted">
          <li className="flex items-start gap-3">
            <CheckGlyph />
            <span>
              Reads only the JSON your authenticated MyScoreIQ tab has
              already loaded — your password never leaves MyScoreIQ.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckGlyph />
            <span>
              Uploads the report to your DisputeIQ workspace over HTTPS,
              authenticated by a one-time pairing code you generate in
              your DisputeIQ dashboard.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckGlyph />
            <span>
              Encrypts the payload at rest in DisputeIQ&apos;s storage.
              Audit log records every import.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckGlyph />
            <span>
              Revocable instantly from the Connector card on your
              dashboard. Uninstall anytime.
            </span>
          </li>
        </ul>
      </section>

      {/* Manual install steps when pre-Web-Store */}
      {inReview && (
        <section className="mt-10 rounded-2xl border border-border bg-surface-muted/40 p-6 text-sm leading-7 text-fg-muted">
          <h2 className="text-lg font-semibold text-fg">
            Manual install (30 seconds)
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6">
            <li>
              Click <strong>Download Connector (.zip)</strong> above. You
              get a file called{" "}
              <code className="font-mono">disputeiq-connector-v0.1.0.zip</code>{" "}
              in your Downloads folder.
            </li>
            <li>
              Unzip it. (Right-click → <em>Extract All…</em> on Windows;
              double-click on Mac.)
            </li>
            <li>
              Open <code className="font-mono">chrome://extensions</code>{" "}
              in your browser, then enable <strong>Developer mode</strong>{" "}
              (top-right toggle).
            </li>
            <li>
              Click <strong>Load unpacked</strong> and select the unzipped
              folder.
            </li>
            <li>
              Pin the DisputeIQ Connector icon to your toolbar (puzzle-piece
              menu → pin) so it&apos;s always one click away.
            </li>
          </ol>
          <p className="mt-3 text-[12px] text-fg-subtle">
            The Web Store install will be a single click once Google
            finishes review.
          </p>
        </section>
      )}

      {/* Pairing instructions */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          After install — pair and import
        </h2>
        <ol className="mt-4 space-y-4 text-sm leading-6 text-fg-muted">
          <li>
            <strong className="text-fg">1 · Sign in to DisputeIQ.</strong>{" "}
            Go to <Link href="/dashboard/get-report" className="underline hover:text-fg">your get-report dashboard</Link>{" "}
            and find the Connector card. Click{" "}
            <strong>Generate pairing code</strong>.
          </li>
          <li>
            <strong className="text-fg">
              2 · Paste the code into the extension popup.
            </strong>{" "}
            Click the DisputeIQ Connector icon in your browser toolbar,
            paste the code, and click <strong>Pair</strong>. The card
            switches to a connected state.
          </li>
          <li>
            <strong className="text-fg">
              3 · Sign in to MyScoreIQ in your browser.
            </strong>{" "}
            Open your{" "}
            <a
              href="https://member.myscoreiq.com/CreditReport.aspx?view=json"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-fg"
            >
              tri-merge JSON report
            </a>
            . Sign in normally if asked.
          </li>
          <li>
            <strong className="text-fg">
              4 · Click the Connector and hit Import.
            </strong>{" "}
            Done. Your report lands in DisputeIQ in seconds and the
            dashboard updates automatically.
          </li>
        </ol>
      </section>

      <footer className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-fg-subtle">
        <Link href="/extension-privacy" className="hover:text-fg">
          Extension privacy policy →
        </Link>
        <Link href="/privacy" className="hover:text-fg">
          DisputeIQ privacy policy →
        </Link>
        <Link href="/terms" className="hover:text-fg">
          Terms of service →
        </Link>
        <a href="mailto:support@disputeiq.org" className="hover:text-fg">
          support@disputeiq.org
        </a>
      </footer>
    </main>
  );
}

function ChromeGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9 6.5h6.5M9 6.5L5.5 12.5M9 6.5L11 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
      <path
        d="M9 2v9m0 0l-3.5-3.5M9 11l3.5-3.5M3 14h12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
      fill="none"
    >
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
