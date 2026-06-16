"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type EnvCheck = { key: string; set: boolean; note?: string };
type EnvGroup = {
  id: string;
  label: string;
  required: boolean;
  ready: boolean;
  checks: EnvCheck[];
  note?: string;
};
type Diag = {
  ok: boolean;
  launchReady: boolean;
  env: { launchReady: boolean; groups: EnvGroup[]; generatedNote: string };
  payments: {
    selectedOneTimeProvider: "SQUARE" | "STRIPE" | null;
    squareConfigured: boolean;
    stripeConfigured: boolean;
  };
  worker: { configured: boolean; reachable: boolean; providers: any[] };
};

type AiResult = {
  provider: string;
  ok: boolean;
  configured: boolean;
  model?: string;
  latencyMs?: number;
  status?: number;
  error?: string;
};

export default function DiagnosticsPage() {
  const [data, setData] = useState<Diag | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [ai, setAi] = useState<{ openai: AiResult; mistral: AiResult } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/diagnostics");
      if (!res.ok) {
        setError(res.status === 403 ? "Admin access required." : `HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as Diag);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAiTest() {
    setAiBusy(true);
    setAiError("");
    setAi(null);
    try {
      const res = await fetch("/api/admin/diagnostics/ai", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setAi({ openai: json.openai, mistral: json.mistral });
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg">Launch diagnostics</h1>
        <button onClick={load} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg">
          Refresh
        </button>
      </div>

      {loading && <p className="mt-6 text-sm text-fg-muted">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          {/* Overall readiness */}
          <div
            className={`mt-6 rounded-2xl border p-5 ${
              data.launchReady
                ? "border-emerald-300 bg-emerald-50"
                : "border-amber-300 bg-amber-50"
            }`}
          >
            <div className="text-lg font-semibold text-fg">
              {data.launchReady ? "✓ Core env vars present" : "⚠ Missing required env vars"}
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {data.env.generatedNote}
            </p>
          </div>

          {/* Payments summary */}
          <section className="mt-6 rounded-2xl border border-default bg-surface/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Payments
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Flag on={data.payments.squareConfigured} label="Square (primary)" />
              <Flag on={data.payments.stripeConfigured} label="Stripe (fallback + subs)" />
              <span className="rounded-full border border-default px-3 py-1 text-fg-muted">
                One-time → {data.payments.selectedOneTimeProvider ?? "NONE configured"}
              </span>
            </div>
          </section>

          {/* Live AI test */}
          <section className="mt-6 rounded-2xl border border-default bg-surface/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
                Live AI test (OpenAI + Mistral)
              </h2>
              <button
                onClick={runAiTest}
                disabled={aiBusy}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {aiBusy ? "Testing…" : "Run AI test"}
              </button>
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              Sends a 1-token completion to each provider — proves the key works here, not just that it's set.
            </p>
            {aiError && <p className="mt-3 text-sm text-red-600">{aiError}</p>}
            {ai && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <AiCard r={ai.openai} />
                <AiCard r={ai.mistral} />
              </div>
            )}
          </section>

          {/* Connector worker health */}
          <section className="mt-6 rounded-2xl border border-default bg-surface/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Connector worker
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Flag on={data.worker.configured} label="Configured" />
              <Flag on={data.worker.reachable} label="Reachable" />
              <Link href="/admin/connectors" className="rounded-full border border-default px-3 py-1 text-fg-muted hover:text-fg">
                Connector health & live tests →
              </Link>
            </div>
          </section>

          {/* Env groups */}
          <section className="mt-6 grid gap-3">
            {data.env.groups.map((g) => (
              <div key={g.id} className="rounded-2xl border border-default bg-surface/60 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Dot ok={g.ready} />
                    <span className="font-semibold text-fg">{g.label}</span>
                    {g.required ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        REQUIRED
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        OPTIONAL
                      </span>
                    )}
                  </div>
                </div>
                {g.note && <p className="mt-1 text-xs text-fg-muted">{g.note}</p>}
                <div className="mt-3 grid gap-1">
                  {g.checks.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-sm">
                      <span className={c.set ? "text-emerald-600" : "text-red-500"}>
                        {c.set ? "✓" : "✕"}
                      </span>
                      <code className="text-xs text-fg">{c.key}</code>
                      {c.note && <span className="text-xs text-fg-muted">— {c.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function AiCard({ r }: { r: AiResult }) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        r.ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
    >
      <div className="font-semibold text-fg">
        {r.ok ? "✓" : "✕"} {r.provider}
        {r.model ? <span className="text-fg-muted"> · {r.model}</span> : null}
      </div>
      <div className="mt-1 text-xs text-fg-muted">
        {!r.configured && "key not set"}
        {r.configured && r.ok && `OK · ${r.latencyMs}ms`}
        {r.configured && !r.ok && (r.error ?? `HTTP ${r.status}`)}
      </div>
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-3.5 w-3.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />;
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`rounded-full px-3 py-1 ${on ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
      {on ? "✓" : "✕"} {label}
    </span>
  );
}
