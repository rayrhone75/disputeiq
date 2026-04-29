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
    <div className="rounded-3xl border border-indigo-300 bg-indigo-50/70 p-6 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">
        Chrome extension import
      </p>
      <h3 className="mt-1 text-lg font-semibold text-fg">
        DisputeIQ Connector for Chrome
      </h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Install once. Then pair with your DisputeIQ account and click
        Import in the popup whenever you want a fresh credit report — no
        copy/paste, no password storage.
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-xs leading-6 text-fg-muted">
        <p className="font-semibold text-fg">Install (developer mode for now):</p>
        <ol className="mt-1 list-decimal pl-5 space-y-1">
          <li>
            Build the extension: run{" "}
            <code className="font-mono">npm run extension:build</code> in the
            DisputeIQ repo.
          </li>
          <li>
            In Chrome, open{" "}
            <code className="font-mono">chrome://extensions</code> → enable{" "}
            <strong>Developer mode</strong>.
          </li>
          <li>
            Click <strong>Load unpacked</strong> → select{" "}
            <code className="font-mono">extension/dist/</code>.
          </li>
          <li>Pin the DisputeIQ Connector icon to your toolbar.</li>
        </ol>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-fg">Pair the extension</p>
          <p className="mt-1 text-xs text-fg-muted">
            Generate a one-time token, then paste it into the extension
            popup. The token expires in 5 minutes.
          </p>
          <button
            type="button"
            onClick={startPair}
            disabled={busy}
            className="mt-3 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Generating…" : "Generate pairing token"}
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
        <p className="mt-5 border-t border-indigo-200/60 pt-4 text-[11px] text-fg-subtle dark:border-indigo-500/20">
          No paired extensions yet.
        </p>
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
