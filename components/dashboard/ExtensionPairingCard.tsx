"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Card on /dashboard/get-report that handles the Chrome-extension
// pairing flow.
//
// Flow:
//   1. User installs the extension (link to Chrome Web Store / load
//      unpacked instructions).
//   2. User clicks "Generate pairing token" → POST /api/extension/pair/start
//      → server returns { pairToken, displayCode }.
//   3. UI shows BOTH the 6-letter display code (for humans) and the
//      full pairToken (one-click "Copy" button). User pastes the full
//      token into the extension popup.
//   4. After successful pair, useQuery refreshes and the
//      paired-extensions list appears.

type PairResponse = {
  ok: true;
  pairToken: string;
  displayCode: string;
  expiresAt: number;
  ttlSeconds: number;
};

type PairedExtension = {
  _id: Id<"extensionPairings">;
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

export function ExtensionPairingCard() {
  const pairings = useQuery(api.extensionPairings.listMine, {}) as
    | PairedExtension[]
    | undefined;
  const revoke = useMutation(api.extensionPairings.revokeMine);

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

  async function onRevoke(id: Id<"extensionPairings">) {
    if (
      !confirm(
        "Revoke this paired extension? It will stop working immediately.",
      )
    )
      return;
    try {
      await revoke({ id });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const activePairings = pairings?.filter((p) => !p.revoked) ?? [];

  return (
    <div className="rounded-3xl border-2 border-indigo-300 bg-indigo-50/70 p-6 shadow-[0_30px_80px_-20px_rgba(99,102,241,0.45)] dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
            Recommended · One-click import
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            DisputeIQ Connector for Chrome
          </h3>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            Install once. From then on, sign in to MyScoreIQ in your
            browser, click the Connector icon, and your report imports
            automatically. Same pattern Client Dispute Manager / Dispute
            Panda / Dispute Fox use — secure, no copy-paste, no password
            storage.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/30 sm:inline-block">
          Best
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <a
          href="/downloads/disputeiq-connector-v0.1.0.zip"
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
          Downloads a small <code className="font-mono">.zip</code> that
          installs as a Chrome extension. We&apos;re finishing Chrome Web
          Store approval; for now it&apos;s a quick 30-second one-time
          install.
        </p>
      </div>

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

      {pairings === undefined ? null : activePairings.length === 0 ? (
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
