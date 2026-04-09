"use client";

import { useState } from "react";

interface FreezeRow {
  id: string;
  provider: string;
  status: string;
}

// LexisNexis freeze also covers SageStream. Innovis is separate.
const FREEZE_GROUPS = [
  {
    key: "lexisnexis_sagestream",
    label: "LexisNexis + SageStream",
    providers: ["LEXISNEXIS", "SAGESTREAM"],
    helpUrl: "https://consumer.risk.lexisnexis.com/freeze",
    note: "LexisNexis is the parent provider for SageStream. Freezing your LexisNexis file also covers SageStream data. Used by lenders, insurers, and tenant screeners.",
    steps: [
      "Visit the LexisNexis consumer freeze portal (link below).",
      "Complete identity verification on their official site.",
      "Submit your freeze request — it covers both LexisNexis and SageStream.",
      "Return here and mark this step as completed.",
    ],
  },
  {
    key: "innovis",
    label: "Innovis",
    providers: ["INNOVIS"],
    helpUrl: "https://www.innovis.com/securityFreeze/index",
    note: "The 'fourth bureau.' Often missed by consumers, but frequently pulled by furnishers. Freezing prevents easy re-verification after disputes.",
    steps: [
      "Visit the Innovis security freeze portal (link below).",
      "Complete identity verification on their official site.",
      "Submit your freeze request.",
      "Return here and mark this step as completed.",
    ],
  },
];

export function FreezePanel({ initial }: { initial: FreezeRow[] }) {
  const [rows, setRows] = useState<FreezeRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  function getGroupStatus(providerKeys: string[]): string {
    const matches = rows.filter((r) => providerKeys.includes(r.provider));
    if (matches.length === 0) return "not_started";
    if (matches.every((r) => r.status === "completed")) return "completed";
    if (matches.some((r) => r.status === "failed")) return "needs_help";
    return "in_progress";
  }

  async function queueAll() {
    if (!consent) {
      setErr("Please confirm the consent checkbox first.");
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
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
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
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const hasStarted = rows.length > 0;

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6">
      <div>
        <h3 className="text-lg font-semibold text-ink-900">Advanced protection (optional)</h3>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          After disputes are sent, freezing your secondary consumer files prevents easy
          re-verification by furnishers. We guide you through the official freeze steps —
          you may need to complete identity verification directly on each provider's site.
        </p>
      </div>

      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}

      <div className="mt-5 space-y-4">
        {FREEZE_GROUPS.map((group) => {
          const status = getGroupStatus(group.providers);
          const isExpanded = expandedGroup === group.key;
          const groupRows = rows.filter((r) => group.providers.includes(r.provider));

          return (
            <div
              key={group.key}
              className="rounded-xl bg-ink-50/60 ring-1 ring-ink-100"
            >
              <button
                type="button"
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink-900">{group.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "needs_help"
                          ? "bg-rose-100 text-rose-700"
                          : status === "in_progress"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-ink-400">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-ink-100 p-4 space-y-3">
                  <p className="text-xs text-ink-600">{group.note}</p>

                  <ol className="space-y-2 text-xs text-ink-700">
                    {group.steps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>

                  <a
                    href={group.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Open {group.label} freeze portal →
                  </a>

                  {groupRows.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {groupRows
                        .filter((r) => r.status !== "completed")
                        .map((r) => (
                          <div key={r.id} className="flex gap-2">
                            <button
                              onClick={() => mark(r.id, "completed")}
                              disabled={busy}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              I completed this
                            </button>
                            <button
                              onClick={() => mark(r.id, "failed")}
                              disabled={busy}
                              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 disabled:opacity-50"
                            >
                              I ran into a problem
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {status === "needs_help" && (
                    <p className="text-xs text-rose-700">
                      Need support? Contact support@disputeiq.org for help completing this freeze.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasStarted && (
        <div className="mt-5 space-y-3 rounded-xl bg-ink-900 p-4 text-white">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to DisputeIQ tracking my freeze intent. I understand I will submit the
            freezes through each provider's official portal myself, and that identity verification
            may be required directly on the provider's site.
          </label>
          <button
            onClick={queueAll}
            disabled={busy || !consent}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-ink-900 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start guided freeze process"}
          </button>
        </div>
      )}
    </section>
  );
}
