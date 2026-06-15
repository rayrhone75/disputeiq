"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProviderRow = {
  id: string;
  label: string;
  slug: string;
  enabled: boolean;
  health: { status: "GREEN" | "YELLOW" | "RED"; reachable: boolean };
};

type DiagResponse = {
  ok: boolean;
  featureEnabled: boolean;
  workerConfigured: boolean;
  vaultConfigured: boolean;
  reportEncryptionConfigured: boolean;
  providers: ProviderRow[];
  sessions?: {
    counts: Record<string, number>;
    recent: {
      _id: string;
      provider: string;
      status: string;
      errorCode: string | null;
      startedAt: number;
    }[];
  };
};

const TEST_SLUG: Record<string, string> = {
  MYSCOREIQ: "myscoreiq-test",
  MYFREESCORENOW: "myfreescorenow-test",
};

export default function ConnectorsDashboard() {
  const [data, setData] = useState<DiagResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/connectors");
      if (!res.ok) {
        setError(res.status === 403 ? "Admin access required." : `HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as DiagResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg">Connector health</h1>
        <button onClick={load} className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg">
          Refresh
        </button>
      </div>

      {loading && <p className="mt-6 text-sm text-fg-muted">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Flag on={data.featureEnabled} label="FEATURE_CREDIT_CONNECTORS" />
            <Flag on={data.workerConfigured} label="Worker configured" />
            <Flag on={data.vaultConfigured} label="Vault key" />
            <Flag on={data.reportEncryptionConfigured} label="Report key" />
          </div>

          <div className="mt-6 grid gap-4">
            {data.providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-default bg-surface/60 p-5"
              >
                <div className="flex items-center gap-4">
                  <Dot status={p.health.status} />
                  <div>
                    <div className="text-lg font-semibold text-fg">{p.label}</div>
                    <div className="text-xs text-fg-muted">
                      {p.health.status}
                      {!p.health.reachable && " · worker unreachable"}
                      {p.enabled ? " · enabled" : " · disabled"}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/admin/connectors/${TEST_SLUG[p.id] ?? ""}`}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Run test
                </Link>
              </div>
            ))}
          </div>

          {data.sessions && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
                Recent sessions
              </h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg-muted">
                {Object.entries(data.sessions.counts).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-default px-3 py-1">
                    {k}: {v}
                  </span>
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-fg-muted">
                {data.sessions.recent.slice(0, 15).map((s) => (
                  <li key={s._id}>
                    {s.provider} — {s.status}
                    {s.errorCode ? ` (${s.errorCode})` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Dot({ status }: { status: "GREEN" | "YELLOW" | "RED" }) {
  const color =
    status === "GREEN" ? "bg-emerald-500" : status === "YELLOW" ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block h-4 w-4 rounded-full ${color}`} />;
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        on ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
      }`}
    >
      {on ? "✓" : "✕"} {label}
    </span>
  );
}
