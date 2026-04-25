"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/primitives";

type Bureau = "EQUIFAX" | "EXPERIAN" | "TRANSUNION";

interface Cell {
  tradelineId: string;
  balanceCents: number | null;
  statusLabel: string | null;
}

interface TriMergeRow {
  groupKey: string;
  creditor: string;
  accountRefMasked: string;
  cells: Partial<Record<Bureau, Cell>>;
  disputable: {
    code: string;
    reason: string;
    confidence: "low" | "medium" | "high";
    recommendedAction: string;
    missingEvidence: string[];
    severity: "low" | "medium" | "high";
    targetBureaus: Bureau[];
  } | null;
}

interface AnalyzeResp {
  triMerge: TriMergeRow[];
  summary: string;
  aiLive: boolean;
}

interface DraftResp {
  disputeCaseId: string;
  bureau: Bureau;
  items: number;
  pages: number;
  legalBasis: string;
  aiLive: boolean;
  bodyText: string;
}

export function ReportFlow({ reportId }: { reportId: string; tradelines: unknown }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResp | null>(null);
  // selection: rowKey -> set of bureaus selected for that row
  const [selected, setSelected] = useState<Record<string, Set<Bureau>>>({});
  const [drafts, setDrafts] = useState<DraftResp[]>([]);
  const [openDraft, setOpenDraft] = useState<DraftResp | null>(null);
  const [disclosures, setDisclosures] = useState(false);

  async function call<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.formErrors?.[0] ?? data?.error ?? `HTTP ${res.status}`);
    return data as T;
  }

  async function runAnalyze() {
    setBusy(true);
    setErr(null);
    try {
      const data = await call<AnalyzeResp>(`/api/reports/${reportId}/analyze`);
      setAnalysis(data);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function toggle(rowKey: string, bureau: Bureau) {
    setSelected((prev) => {
      const next = { ...prev };
      const cur = new Set(next[rowKey] ?? []);
      if (cur.has(bureau)) cur.delete(bureau);
      else cur.add(bureau);
      if (cur.size === 0) delete next[rowKey];
      else next[rowKey] = cur;
      return next;
    });
  }

  // Group selections into per-bureau packets
  const packets = useMemo(() => {
    const out: Record<Bureau, Array<{ tradelineId: string; findingCode: string; findingDetail: string }>> = {
      EQUIFAX: [],
      EXPERIAN: [],
      TRANSUNION: [],
    };
    if (!analysis) return out;
    for (const row of analysis.triMerge) {
      const sel = selected[row.groupKey];
      if (!sel || !row.disputable) continue;
      for (const b of sel) {
        const cell = row.cells[b];
        if (!cell) continue;
        out[b].push({
          tradelineId: cell.tradelineId,
          findingCode: row.disputable.code,
          findingDetail: row.disputable.reason,
        });
      }
    }
    return out;
  }, [analysis, selected]);

  const totalSelected = packets.EQUIFAX.length + packets.EXPERIAN.length + packets.TRANSUNION.length;
  const packetsWithItems = (Object.entries(packets) as [Bureau, typeof packets.EQUIFAX][]).filter(
    ([, items]) => items.length > 0,
  );

  async function buildPackets() {
    setBusy(true);
    setErr(null);
    setDrafts([]);
    try {
      const built: DraftResp[] = [];
      for (const [bureau, items] of packetsWithItems) {
        const data = await call<DraftResp>(`/api/disputes/draft-packet`, {
          bureau,
          letterType: "FACTUAL_DISPUTE",
          items,
        });
        built.push(data);
      }
      setDrafts(built);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndPay(draft: DraftResp) {
    if (!disclosures) {
      setErr("Accept disclosures before sending.");
      return;
    }
    // Route to the pre-payment review + consent screen. That page captures
    // the four required consents, writes a ConsentReceipt, and then calls
    // Square. Never skip the consent screen.
    window.location.href = `/dashboard/checkout/${draft.disputeCaseId}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-fg">Tri-merge action center</div>
          <div className="text-xs text-fg-muted">
            All three bureaus, side by side. Select what you want disputed and we'll bundle it into one packet per bureau.
          </div>
        </div>
        <Button onClick={runAnalyze} disabled={busy}>
          {busy && !analysis ? "Analyzing…" : analysis ? "Re-run analysis" : "Run AI analysis"}
        </Button>
      </div>

      {err && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{err}</div>
      )}

      {analysis && (
        <>
          <div className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900 ring-1 ring-indigo-100">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide">
              AI summary {analysis.aiLive ? "" : "(offline fallback)"}
            </div>
            {analysis.summary}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-strong bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Equifax</th>
                  <th className="px-4 py-3 text-left">Experian</th>
                  <th className="px-4 py-3 text-left">TransUnion</th>
                  <th className="px-4 py-3 text-left">Disputable</th>
                </tr>
              </thead>
              <tbody>
                {analysis.triMerge.map((row) => (
                  <tr key={row.groupKey} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-fg">{row.creditor}</div>
                      <div className="text-xs text-fg-muted">{row.accountRefMasked}</div>
                    </td>
                    {(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).map((b) => {
                      const cell = row.cells[b];
                      const hasFinding = !!row.disputable;
                      const isSelected = selected[row.groupKey]?.has(b) ?? false;
                      return (
                        <td key={b} className="px-4 py-3">
                          {cell ? (
                            <label
                              className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 ${
                                isSelected ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-surface-muted"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={!hasFinding}
                                checked={isSelected}
                                onChange={() => toggle(row.groupKey, b)}
                                className="mt-0.5"
                              />
                              <div>
                                <div className="text-xs">
                                  {cell.balanceCents != null
                                    ? `$${(cell.balanceCents / 100).toFixed(2)}`
                                    : "—"}
                                </div>
                                <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
                                  {cell.statusLabel ?? "no status"}
                                </div>
                              </div>
                            </label>
                          ) : (
                            <span className="text-xs text-fg-subtle">not reported</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      {row.disputable ? (
                        <div className="space-y-1">
                          <div
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              row.disputable.severity === "high"
                                ? "bg-rose-100 text-rose-700"
                                : row.disputable.severity === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-surface-muted text-fg-muted"
                            }`}
                          >
                            {row.disputable.code} · {row.disputable.confidence} confidence
                          </div>
                          <div className="text-xs text-fg-muted">{row.disputable.reason}</div>
                          <div className="text-[11px] text-fg-subtle">
                            <span className="font-semibold">Action:</span> {row.disputable.recommendedAction}
                          </div>
                          {row.disputable.missingEvidence.length > 0 && (
                            <div className="text-[11px] text-fg-subtle">
                              <span className="font-semibold">Missing:</span>{" "}
                              {row.disputable.missingEvidence.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-fg-subtle">No automated finding</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalSelected > 0 && drafts.length === 0 && (
            <div className="flex items-center justify-between rounded-xl bg-fg p-5 text-canvas">
              <div>
                <div className="text-sm font-semibold">
                  {totalSelected} item(s) across {packetsWithItems.length} bureau packet(s)
                </div>
                <div className="text-xs text-canvas/70">
                  One certified mail packet per bureau. Flat fee per packet — same price regardless of how many items inside.
                </div>
              </div>
              <Button onClick={buildPackets} disabled={busy}>
                {busy ? "Drafting…" : "Build packet(s)"}
              </Button>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-fg">
                Drafts ready · {drafts.length} packet(s)
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {drafts.map((d) => (
                  <div key={d.disputeCaseId} className="rounded-xl border border-border-strong bg-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      {d.bureau}
                    </div>
                    <div className="mt-1 text-sm text-fg">
                      {d.items} item(s) · {d.pages} page(s)
                    </div>
                    <div className="mt-1 text-[11px] text-fg-subtle">{d.legalBasis}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setOpenDraft(d)}
                        className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs hover:bg-surface-muted/80"
                      >
                        Preview (locked)
                      </button>
                      <button
                        onClick={() => confirmAndPay(d)}
                        disabled={busy}
                        className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={disclosures}
                  onChange={(e) => setDisclosures(e.target.checked)}
                />
                I have read and accept the FCRA dispute disclosures and confirm the facts in these packets are true to the best of my knowledge.
              </label>
            </div>
          )}
        </>
      )}

      {openDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpenDraft(null)}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rotate-[-18deg] text-6xl font-black text-rose-500/15 select-none">
                DISPUTEIQ — UNPAID DRAFT — NOT VALID FOR SUBMISSION
              </div>
            </div>
            <div className="relative max-h-[80vh] overflow-y-auto p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {openDraft.bureau} packet · locked preview
                </div>
                <button
                  onClick={() => setOpenDraft(null)}
                  className="text-xs text-fg-muted hover:text-fg"
                >
                  Close
                </button>
              </div>
              <div className="text-[11px] text-fg-subtle">
                This is a watermarked, screen-only preview. The mailable PDF stays in secure storage and is never downloadable until the packet has been paid for and dispatched. There is no free, usable letter output.
              </div>
              <pre className="mt-4 select-none whitespace-pre-wrap text-xs text-fg">
                {openDraft.bodyText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
