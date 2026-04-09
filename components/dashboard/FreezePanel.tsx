"use client";

import { useState } from "react";

interface FreezeRow {
  id: string;
  provider: string;
  status: string;
}

const PROVIDER_INFO: Record<string, { label: string; helpUrl: string; note: string }> = {
  LEXISNEXIS: {
    label: "LexisNexis",
    helpUrl: "https://consumer.risk.lexisnexis.com/freeze",
    note: "Used by lenders, insurers, and tenant screeners. Freeze blocks new file pulls.",
  },
  INNOVIS: {
    label: "Innovis",
    helpUrl: "https://www.innovis.com/securityFreeze/index",
    note: "The 'fourth bureau.' Often missed by users, often pulled by furnishers.",
  },
  SAGESTREAM: {
    label: "SageStream",
    helpUrl: "https://www.sagestreamllc.com/security-freeze/",
    note: "Used in alternative-lender underwriting. Freeze prevents soft re-verification.",
  },
};

export function FreezePanel({ initial }: { initial: FreezeRow[] }) {
  const [rows, setRows] = useState<FreezeRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function queueAll() {
    if (!consent) {
      setErr("Confirm the consent box before queueing freezes.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      const refresh = await fetch("/api/freeze").then((r) => r.json());
      setRows(refresh.freezes ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function mark(id: string, status: "completed" | "failed") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/freeze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">Secondary bureau freezes</h3>
          <p className="mt-1 max-w-xl text-sm text-ink-600">
            After disputes are sent, freezing your secondary consumer files (LexisNexis, Innovis, SageStream) prevents easy re-verification. There is no public API for these — DisputeIQ tracks your intent and confirmation status; you submit the freeze through each bureau's official portal.
          </p>
        </div>
      </div>

      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}

      <ul className="mt-5 space-y-3">
        {(["LEXISNEXIS", "INNOVIS", "SAGESTREAM"] as const).map((p) => {
          const row = rows.find((r) => r.provider === p);
          const info = PROVIDER_INFO[p];
          const status = row?.status ?? "not_started";
          return (
            <li
              key={p}
              className="flex items-start justify-between gap-4 rounded-xl bg-ink-50/60 p-4 ring-1 ring-ink-100"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">{info.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-600">{info.note}</p>
                <a
                  href={info.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Open {info.label} freeze portal →
                </a>
              </div>
              {row && status === "pending" && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => mark(row.id, "completed")}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => mark(row.id, "failed")}
                    disabled={busy}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 disabled:opacity-50"
                  >
                    Mark failed
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <div className="mt-5 space-y-3 rounded-xl bg-ink-900 p-4 text-white">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to DisputeIQ tracking my freeze intent for these three secondary bureaus. I understand I will submit the freezes through each bureau's official portal myself.
          </label>
          <button
            onClick={queueAll}
            disabled={busy || !consent}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-ink-900 disabled:opacity-50"
          >
            {busy ? "Queueing…" : "Queue freezes"}
          </button>
        </div>
      )}
    </section>
  );
}
