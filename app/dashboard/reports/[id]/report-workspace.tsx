"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Bureau = "EQUIFAX" | "EXPERIAN" | "TRANSUNION";

interface TradeLine {
  id: string;
  bureau: string;
  creditor: string;
  account: string;
  balanceCents: number | null;
  status: string | null;
  isCollection: boolean;
  isMedical: boolean;
}

interface TriMergeRow {
  groupKey: string;
  creditor: string;
  accountRefMasked: string;
  cells: Partial<Record<Bureau, { tradelineId: string; balanceCents: number | null; statusLabel: string | null }>>;
  disputable: {
    code: string;
    reason: string;
    confidence: string;
    recommendedAction: string;
    missingEvidence: string[];
    severity: string;
    targetBureaus: Bureau[];
  } | null;
}

interface AnalyzeResp {
  triMerge: TriMergeRow[];
  summary: string;
  aiLive: boolean;
  findings: Array<{ code: string; severity: string; creditor: string; detail: string }>;
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

export function ReportWorkspace({ reportId, tradelines }: { reportId: string; tradelines: TradeLine[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResp | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<Bureau>>>({});
  const [drafts, setDrafts] = useState<DraftResp[]>([]);
  const [disclosures, setDisclosures] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function call<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
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

  async function deleteReport() {
    if (!confirm("Delete this report and all parsed tradelines? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await call(`/api/reports/${reportId}/delete`);
      router.push("/dashboard/reports");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setDeleting(false);
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

  const packets = useMemo(() => {
    const out: Record<Bureau, Array<{ tradelineId: string; findingCode: string; findingDetail: string }>> = {
      EQUIFAX: [], EXPERIAN: [], TRANSUNION: [],
    };
    if (!analysis) return out;
    for (const row of analysis.triMerge) {
      const sel = selected[row.groupKey];
      if (!sel || !row.disputable) continue;
      for (const b of sel) {
        const cell = row.cells[b];
        if (!cell) continue;
        out[b].push({ tradelineId: cell.tradelineId, findingCode: row.disputable.code, findingDetail: row.disputable.reason });
      }
    }
    return out;
  }, [analysis, selected]);

  const totalSelected = packets.EQUIFAX.length + packets.EXPERIAN.length + packets.TRANSUNION.length;
  const packetsWithItems = (Object.entries(packets) as [Bureau, typeof packets.EQUIFAX][]).filter(([, items]) => items.length > 0);

  async function buildPackets() {
    setBusy(true);
    setErr(null);
    setDrafts([]);
    try {
      const built: DraftResp[] = [];
      for (const [bureau, items] of packetsWithItems) {
        const data = await call<DraftResp>(`/api/disputes/draft-packet`, { bureau, letterType: "FACTUAL_DISPUTE", items });
        built.push(data);
      }
      setDrafts(built);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Summary stats
  const collections = tradelines.filter((t) => t.isCollection).length;
  const negatives = tradelines.filter((t) => t.status && /collection|charge.?off|past.?due|delinq/i.test(t.status)).length;
  const findingCount = analysis?.findings?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Total accounts", value: tradelines.length, tone: "ink" },
          { label: "Collections", value: collections, tone: collections > 0 ? "rose" : "ink" },
          { label: "Negative items", value: negatives, tone: negatives > 0 ? "amber" : "ink" },
          { label: "Issues found", value: findingCount, tone: findingCount > 0 ? "indigo" : "ink" },
          { label: "Selected", value: totalSelected, tone: totalSelected > 0 ? "emerald" : "ink" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-wide text-ink-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${c.tone === "rose" ? "text-rose-600" : c.tone === "amber" ? "text-amber-600" : c.tone === "indigo" ? "text-indigo-600" : c.tone === "emerald" ? "text-emerald-600" : "text-ink-900"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={runAnalyze} disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy && !analysis ? "Analyzing…" : analysis ? "Re-run AI analysis" : "Run AI analysis"}
        </button>
        <button onClick={deleteReport} disabled={deleting} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 disabled:opacity-50">
          {deleting ? "Deleting…" : "Delete report"}
        </button>
      </div>

      {err && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{err}</div>}

      {/* AI summary */}
      {analysis && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-900">AI analysis</h3>
            {!analysis.aiLive && <span className="text-[10px] text-amber-600 uppercase">offline fallback</span>}
          </div>
          {analysis.findings && analysis.findings.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {analysis.findings.slice(0, 8).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    f.severity === "high" ? "bg-rose-100 text-rose-700" : f.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-600"
                  }`}>{f.severity}</span>
                  <div>
                    <span className="text-xs font-semibold text-ink-900">{f.creditor}</span>
                    <span className="text-xs text-ink-600"> — {f.code}: {f.detail.slice(0, 120)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-indigo-900/75">{analysis.summary}</p>
          )}
        </div>
      )}

      {/* Account cards / tri-merge table */}
      {analysis ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-900">
            Accounts ({analysis.triMerge.length})
          </h3>
          {analysis.triMerge.map((row) => (
            <div key={row.groupKey} className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink-900">{row.creditor}</div>
                  <div className="text-xs text-ink-500">{row.accountRefMasked}</div>
                </div>
                {row.disputable && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    row.disputable.severity === "high" ? "bg-rose-100 text-rose-700" :
                    row.disputable.severity === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-ink-100 text-ink-600"
                  }`}>{row.disputable.code}</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as Bureau[]).map((b) => {
                  const cell = row.cells[b];
                  const isSelected = selected[row.groupKey]?.has(b) ?? false;
                  return (
                    <div key={b} className={`rounded-lg p-2.5 text-xs ${cell ? (isSelected ? "bg-indigo-50 ring-1 ring-indigo-300" : "bg-ink-50") : "bg-ink-50/40"}`}>
                      <div className="text-[10px] font-semibold uppercase text-ink-500">
                        {b === "EQUIFAX" ? "EQ" : b === "EXPERIAN" ? "EX" : "TU"}
                      </div>
                      {cell ? (
                        <>
                          <div className="mt-1 font-semibold text-ink-900">
                            {cell.balanceCents != null ? `$${(cell.balanceCents / 100).toFixed(2)}` : "—"}
                          </div>
                          <div className="text-ink-600">{cell.statusLabel ?? "No status"}</div>
                          {row.disputable && (
                            <label className="mt-2 flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={isSelected} onChange={() => toggle(row.groupKey, b)} />
                              <span className="text-[10px] text-ink-600">Select</span>
                            </label>
                          )}
                        </>
                      ) : (
                        <div className="mt-1 text-ink-400">Not reported</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {row.disputable && (
                <div className="mt-3 rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
                  <span className="font-semibold">Action:</span> {row.disputable.recommendedAction}
                  {row.disputable.missingEvidence.length > 0 && (
                    <span className="ml-2 text-ink-500">
                      Missing: {row.disputable.missingEvidence.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Pre-analysis account list */
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">Parsed accounts ({tradelines.length})</h3>
          {tradelines.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                  {t.bureau === "Equifax" ? "EQ" : t.bureau === "Experian" ? "EX" : "TU"}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-900">{t.creditor}</div>
                  <div className="text-xs text-ink-500">{t.account}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-900">
                  {t.balanceCents != null ? `$${(t.balanceCents / 100).toFixed(2)}` : "—"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-600">{t.status ?? "—"}</span>
                  {t.isCollection && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Collection</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Build packets */}
      {totalSelected > 0 && drafts.length === 0 && (
        <div className="flex items-center justify-between rounded-xl bg-ink-900 p-5 text-white">
          <div>
            <div className="text-sm font-semibold">{totalSelected} item(s) across {packetsWithItems.length} bureau packet(s)</div>
            <div className="text-xs text-white/70">One certified mail packet per bureau. Same price regardless of items inside.</div>
          </div>
          <button onClick={buildPackets} disabled={busy} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 disabled:opacity-50">
            {busy ? "Drafting…" : "Build packet(s)"}
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-ink-900">Drafts ready ({drafts.length})</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {drafts.map((d) => (
              <div key={d.disputeCaseId} className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase text-indigo-600">{d.bureau}</div>
                <div className="mt-1 text-sm text-ink-900">{d.items} item(s) · {d.pages} page(s)</div>
                <div className="mt-1 text-[10px] text-ink-500">{d.legalBasis}</div>
                <button
                  onClick={() => router.push(`/dashboard/checkout/${d.disputeCaseId}`)}
                  className="mt-3 w-full rounded-lg bg-ink-900 py-2 text-xs font-semibold text-white"
                >
                  Review & send →
                </button>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs text-ink-700">
            <input type="checkbox" checked={disclosures} onChange={(e) => setDisclosures(e.target.checked)} />
            I confirm the facts in these packets are true to the best of my knowledge.
          </label>
        </div>
      )}
    </div>
  );
}
