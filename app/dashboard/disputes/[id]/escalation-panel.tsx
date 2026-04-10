"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  {
    key: "redispute",
    label: "Re-dispute (Round 2)",
    desc: "Reference your prior dispute, highlight inconsistencies, and demand reinvestigation under FCRA §611.",
    legal: "FCRA §611 — reinvestigation demand",
    round: 2,
  },
  {
    key: "mov",
    label: "Method of Verification (Round 3)",
    desc: "Request the bureau disclose exactly how they verified the item — who they contacted, what they reviewed, and what procedure they used.",
    legal: "FCRA §611(a)(6)(B)(iii) — MOV request",
    round: 3,
  },
  {
    key: "cfpb",
    label: "CFPB Complaint",
    desc: "File a formal complaint with the Consumer Financial Protection Bureau. Includes your full dispute timeline, delivery proof, and the bureau's failure to resolve.",
    legal: "12 CFR §1022 / FCRA §611",
    round: 4,
  },
  {
    key: "direct_furnisher",
    label: "Direct Creditor / Furnisher Letter",
    desc: "Send a validation request directly to the creditor or collector, bypassing the bureau. Demands they investigate under FCRA §623(b).",
    legal: "FCRA §623(b) — furnisher investigation duty",
    round: 3,
  },
];

export function EscalationPanel({
  disputeCaseId,
  suggestedStage,
  priorCount,
  creditor,
}: {
  disputeCaseId: string;
  suggestedStage: string;
  priorCount: number;
  creditor: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    stage: string;
    bodyText: string;
    legalBasis: string;
    newDisputeCaseId: string;
  } | null>(null);

  async function escalate(stage: string) {
    setBusy(stage);
    setErr(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/disputes/${disputeCaseId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Escalation failed");
      setPreview({
        stage: data.stage,
        bodyText: data.bodyText,
        legalBasis: data.legalBasis,
        newDisputeCaseId: data.newDisputeCaseId,
      });
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Escalation options</h2>
        <p className="mt-1 text-sm text-ink-600">
          This dispute on <strong>{creditor}</strong> has been through{" "}
          <strong>{priorCount} round(s)</strong>. Choose your next step below. Each generates a
          real letter grounded in your dispute history — no generic templates, no promises.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {STAGES.map((s) => {
          const isSuggested = s.key === suggestedStage;
          return (
            <div
              key={s.key}
              className={`rounded-xl border p-4 ${
                isSuggested
                  ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                  : "border-ink-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink-900">{s.label}</div>
                  {isSuggested && (
                    <span className="text-[10px] font-semibold uppercase text-indigo-600">
                      Recommended next step
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-600">{s.desc}</p>
              <p className="mt-1 text-[10px] text-ink-500">{s.legal}</p>
              <button
                onClick={() => escalate(s.key)}
                disabled={busy === s.key}
                className="mt-3 w-full rounded-lg bg-ink-900 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy === s.key ? "Generating…" : `Generate ${s.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {err && <p className="text-xs text-rose-600">{err}</p>}

      {preview && (
        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink-900">
                {STAGES.find((s) => s.key === preview.stage)?.label} — draft ready
              </div>
              <div className="text-[10px] text-ink-500">{preview.legalBasis}</div>
            </div>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
              Unpaid draft
            </span>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rotate-[-18deg] text-4xl font-black text-rose-500/10 select-none">
                UNPAID DRAFT
              </div>
            </div>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-4 text-xs text-ink-800 select-none ring-1 ring-ink-200">
              {preview.bodyText}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/dashboard/checkout/${preview.newDisputeCaseId}`)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white"
            >
              Review & send →
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-lg bg-white px-4 py-2 text-xs text-ink-600 ring-1 ring-ink-200"
            >
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-ink-500">
            This is a watermarked preview only. The mailable PDF stays in secure storage.
            No letter is sent until you complete the consent screen and payment.
          </p>
        </div>
      )}
    </div>
  );
}
