"use client";

import { useCallback, useEffect, useState } from "react";

// Card on /dashboard/get-report that handles the Chrome-extension
// pairing flow.
//
// Hard rule: NO direct `useQuery` / `useMutation` from convex/react.
// Earlier versions used those hooks against api.extensionPairings.*,
// and any throw inside a Convex query (user-not-mirrored, schema blip,
// transient unavailability) propagated as an unhandled exception
// during render — crashing the entire /dashboard/get-report route in
// React 19. Now everything goes through fail-soft fetch endpoints
// (/api/extension/pairings + /pairings/:id/revoke) so a Convex blip
// degrades to a "Connector status unavailable — retry" panel instead
// of a route-level crash.
//
// Flow:
//   1. Install the extension (Web Store URL when set, else ZIP download).
//   2. Click "Generate pairing code" → POST /api/extension/pair/start
//      → server returns { pairToken, displayCode }.
//   3. Show the 6-letter display code (for humans) + the full pairToken
//      (one-click "Copy" button). User pastes the full token into the
//      extension popup.
//   4. After successful pair, refresh the listing via fetch.

type PairResponse = {
  ok: true;
  pairToken: string;
  displayCode: string;
  expiresAt: number;
  ttlSeconds: number;
};

type PairedExtension = {
  _id: string;
  extensionVersion: string | null;
  userAgent: string | null;
  pairedAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
  lastImportAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  revoked: boolean;
  revokedAt: number | null;
};

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; pairings: PairedExtension[] }
  | { kind: "error"; message: string };

export function ExtensionPairingCard() {
  const [list, setList] = useState<ListState>({ kind: "loading" });

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/extension/pairings", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pairings?: PairedExtension[];
        message?: string;
        code?: string;
      };
      if (data.ok && Array.isArray(data.pairings)) {
        setList({ kind: "ready", pairings: data.pairings });
      } else if (Array.isArray(data.pairings)) {
        // ok:false but with empty pairings — soft failure mode. Show
        // an error pill but keep the rest of the card functional.
        setList({
          kind: "error",
          message:
            data.message ?? "Connector status unavailable — retry below.",
        });
      } else {
        setList({
          kind: "error",
          message: data.message ?? "Connector status unavailable.",
        });
      }
    } catch (err) {
      setList({
        kind: "error",
        message: `Connector status unavailable: ${(err as Error).message}`,
      });
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const [pair, setPair] = useState<PairResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  useEffect(() => {
    if (!pair) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((pair.expiresAt - Date.now()) / 1000),
      );
      setExpiresIn(left);
      if (left === 0) setPair(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pair]);

  async function startPair() {
    setBusy(true);
    setErr(null);
    setPair(null);
    setCopied(false);
    try {
      const res = await fetch("/api/extension/pair/start", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not start pair.");
      }
      setPair(data as PairResponse);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPairToken() {
    if (!pair) return;
    try {
      await navigator.clipboard.writeText(pair.pairToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function onRevoke(id: string) {
    if (
      !confirm(
        "Revoke this paired extension? It will stop working immediately.",
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/extension/pairings/${encodeURIComponent(id)}/revoke`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setErr(data.message ?? data.code ?? "Could not revoke.");
        return;
      }
      await refreshList();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const activePairings =
    list.kind === "ready" ? list.pairings.filter((p) => !p.revoked) : [];

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
            Optional · For repeat imports
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-fg sm:text-xl">
            DisputeIQ Connector for Chrome
          </h3>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            If you plan to pull updated reports often, install the
            Connector once. After it's paired, future imports take one
            click from your MyScoreIQ tab — no download, no upload.
          </p>
        </div>
      </div>

      <InstallCta />

      <p className="mt-3 text-[11px] leading-5 text-fg-subtle">
        Need help? See the public install page at{" "}
        <a href="/connector" className="underline hover:text-fg">
          /connector
        </a>{" "}
        for full step-by-step instructions.
      </p>

      <details className="mt-3 rounded-2xl border border-border bg-surface px-4 py-3 text-xs leading-6 text-fg-muted">
        <summary className="cursor-pointer list-none font-semibold text-fg-muted hover:text-fg">
          <span className="inline-flex items-center gap-2">
            Install steps (30 seconds)
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
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>
            Click <strong>Install Connector</strong> above. You&apos;ll get
            a file called{" "}
            <code className="font-mono">disputeiq-connector-v0.1.0.zip</code>{" "}
            in your Downloads folder.
          </li>
          <li>
            Unzip it (right-click → <strong>Extract All…</strong> on
            Windows, or just double-click on Mac). You&apos;ll get a folder.
          </li>
          <li>
            In Chrome, open{" "}
            <code className="font-mono">chrome://extensions</code> and toggle{" "}
            <strong>Developer mode</strong> (top-right) on.
          </li>
          <li>
            Click <strong>Load unpacked</strong> → select the unzipped
            folder.
          </li>
          <li>
            Pin the DisputeIQ Connector icon (puzzle-piece menu → pin)
            so it&apos;s always one click away.
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-fg-subtle">
          Edge and Brave use the same flow — they&apos;re Chrome under the
          hood.
        </p>
      </details>

      <div className="mt-5 space-y-3 border-t border-indigo-200/60 pt-5 dark:border-indigo-500/20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Step 2 · After install
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">
            Pair the extension to your DisputeIQ account
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Click the button to generate a one-time pairing code. Open the
            DisputeIQ Connector popup in Chrome (puzzle-piece icon in your
            toolbar) and paste the code there. Code expires in 5 minutes.
          </p>
          <button
            type="button"
            onClick={startPair}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Generating…" : "Generate pairing code"}
          </button>
        </div>

        {pair && (
          <div className="rounded-2xl border border-indigo-300 bg-white/80 p-4 text-xs dark:bg-indigo-950/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Display code (for support / phone)
              </span>
              <span className="text-[10px] text-fg-muted">
                Expires in {expiresIn}s
              </span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-fg">
              {pair.displayCode}
            </p>

            <div className="mt-4">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Full pairing token (paste this into the extension)
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={pair.pairToken}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 font-mono text-[11px] text-fg"
                />
                <button
                  type="button"
                  onClick={copyPairToken}
                  className="shrink-0 rounded-lg bg-fg px-3 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-fg-subtle">
              Open the extension popup, paste this token, click{" "}
              <strong>Pair Extension</strong>. After pairing, the
              long-lived extension token is stored in your browser only —
              DisputeIQ keeps a SHA-256 hash for revocation only.
            </p>
          </div>
        )}

        {err && (
          <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {err}
          </p>
        )}
      </div>

      {list.kind === "loading" ? null : list.kind === "error" ? (
        // Status couldn't load (rare — Convex blip, network drop). We
        // deliberately don't show a red banner here: the page shouldn't
        // look broken for a first-time customer who has no pairings
        // anyway. Silent neutral hint + a quiet retry link.
        <div className="mt-5 border-t border-indigo-200/60 pt-4 dark:border-indigo-500/20">
          <p className="text-[12px] text-fg-subtle">
            No connector paired yet.{" "}
            <button
              type="button"
              onClick={() => void refreshList()}
              className="underline underline-offset-2 hover:text-fg"
            >
              Refresh status
            </button>
          </p>
        </div>
      ) : activePairings.length === 0 ? (
        <div className="mt-5 border-t border-indigo-200/60 pt-5 dark:border-indigo-500/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Step 3 · Connect your report
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            Once paired, sign in to your{" "}
            <a
              href="https://member.myscoreiq.com/CreditReport.aspx?view=json"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg underline"
            >
              MyScoreIQ tri-merge report
            </a>{" "}
            in any tab and click the DisputeIQ Connector icon. The
            extension imports your report in seconds — your password
            never leaves MyScoreIQ.
          </p>
        </div>
      ) : (
        <div className="mt-5 border-t border-indigo-200/60 pt-4 dark:border-indigo-500/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Paired extensions
          </p>
          <ul className="mt-2 space-y-2">
            {activePairings.map((p) => (
              <li
                key={p._id}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-fg">
                      v{p.extensionVersion ?? "?"}
                      {p.lastImportAt
                        ? ` · last import ${new Date(p.lastImportAt).toLocaleDateString()}`
                        : " · no imports yet"}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      Paired {new Date(p.pairedAt).toLocaleDateString()} ·
                      expires {new Date(p.expiresAt).toLocaleDateString()}
                      {p.lastError ? ` · last error: ${p.lastError}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRevoke(p._id)}
                    className="shrink-0 rounded-lg border border-rose-300 bg-transparent px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 border-t border-indigo-200/60 pt-4 text-[11px] leading-relaxed text-fg-subtle dark:border-indigo-500/20">
        Privacy: the extension never sees your MyScoreIQ password. It
        reads the JSON your authenticated browser already loaded and
        POSTs it to DisputeIQ over HTTPS, signed with a token unique to
        your install. Revoke any time from this card.
      </p>
    </div>
  );
}

// Install CTA: prefers the Chrome Web Store URL when configured, falls
// back to the bundled ZIP and a manual-install disclosure. Picking the
// right path at build time means a single env var flip switches every
// install button at once.
function InstallCta() {
  const webStoreUrl =
    process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ?? null;
  // Routed through /api/extension/download so the response gets
  // Content-Disposition: attachment + an audit-log entry. The version
  // string in the file name is owned by extension/manifest.json.
  const zipUrl = "/api/extension/download";

  if (webStoreUrl) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <a
          href={webStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fg px-6 py-3.5 text-sm font-semibold text-canvas shadow-[0_18px_48px_-18px_rgba(99,102,241,0.55)] transition hover:-translate-y-0.5 hover:opacity-95"
        >
          <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle
              cx="9"
              cy="9"
              r="2.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M9 6.5h6.5M9 6.5L5.5 12.5M9 6.5L11 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Add to Chrome
        </a>
        <p className="text-[12px] leading-5 text-fg-muted">
          One-click install from the Chrome Web Store. Works in Chrome,
          Edge, Brave, and other Chromium browsers.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
      <a
        href={zipUrl}
        download
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fg px-6 py-3.5 text-sm font-semibold text-canvas shadow-[0_18px_48px_-18px_rgba(99,102,241,0.55)] transition hover:-translate-y-0.5 hover:opacity-95"
      >
        <svg viewBox="0 0 18 18" className="h-5 w-5" fill="none">
          <path
            d="M9 2v9m0 0l-3.5-3.5M9 11l3.5-3.5M3 14h12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Install Connector
      </a>
      <p className="text-[12px] leading-5 text-fg-muted">
        We&apos;re awaiting Chrome Web Store approval. For now, this is a
        signed{" "}
        <code className="font-mono">.zip</code> — 30-second one-time
        install. The Web Store flow goes live the moment we&apos;re
        approved.
      </p>
    </div>
  );
}
