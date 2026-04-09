"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeliveredCase {
  disputeCaseId: string;
  creditor: string;
  bureau: string;
  deliveredAt: string;
  trackingCode: string | null;
}

// Letter Checker — when a packet is delivered by LetterStream, this panel
// prompts the user to report the outcome. Outcomes:
//   removed → DisputeCase → CLOSED
//   failed  → DisputeCase → ESCALATION_READY (one-click re-dispute)
//   upload  → open bureau-response upload modal → Claude classifies + recommends
export function LetterChecker({ delivered }: { delivered: DeliveredCase[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  if (delivered.length === 0) return null;

  async function mark(id: string, outcome: "removed" | "failed" | "partial") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/disputes/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  async function redispute(id: string) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/disputes/${id}/redispute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      router.push(`/dashboard/checkout/${data.newDisputeCaseId}`);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setBusy(null);
    }
  }

  async function uploadResponse(id: string, file: File) {
    setBusy(id);
    setErr(null);
    setAnalysis(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/disputes/${id}/response-upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setAnalysis(data.analysis);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-indigo-900">Letter Checker</h3>
          <p className="mt-1 text-sm text-indigo-900/70">
            These packets were delivered to the bureau. Tell us the outcome — we'll close them out
            or queue a stronger re-dispute automatically.
          </p>
        </div>
      </div>
      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}

      <ul className="mt-5 space-y-3">
        {delivered.map((d) => (
          <li
            key={d.disputeCaseId}
            className="rounded-xl bg-white p-4 ring-1 ring-indigo-100"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">
                  {d.creditor} · {d.bureau}
                </div>
                <div className="text-[11px] text-ink-500">
                  Delivered {new Date(d.deliveredAt).toLocaleDateString()}
                  {d.trackingCode && ` · ${d.trackingCode}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy === d.disputeCaseId}
                  onClick={() => mark(d.disputeCaseId, "removed")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  ✔ Removed
                </button>
                <button
                  disabled={busy === d.disputeCaseId}
                  onClick={() => mark(d.disputeCaseId, "failed")}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  ✕ Not removed
                </button>
                <button
                  disabled={busy === d.disputeCaseId}
                  onClick={() => redispute(d.disputeCaseId)}
                  className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Generate re-dispute
                </button>
                <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
                  Upload bureau letter
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFor(d.disputeCaseId);
                        uploadResponse(d.disputeCaseId, f);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            {uploadFor === d.disputeCaseId && analysis && (
              <div className="mt-3 rounded-lg bg-ink-50 p-3 text-xs text-ink-800">
                <div className="mb-1 font-semibold">AI response analysis</div>
                <pre className="whitespace-pre-wrap">{analysis}</pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
