"use client";

import { useState } from "react";

// Dev-only test page. Drop a credit-report file in, see exactly what
// the Mistral OCR + paralegal pipeline extracts. Skips Clerk + Convex
// so it works without the rest of the backend wired up.

type Stage = { event: string; data?: Record<string, unknown> };
type Counts = {
  tradelines: number;
  inquiries: number;
  collections: number;
  publicRecords: number;
  scores: number;
};
type SuccessResponse = {
  ok: true;
  elapsedMs: number;
  input: { format: string; size: number; filename: string };
  stages: Stage[];
  result: {
    confidence: string;
    counts: Counts;
    reasonCodes: string[];
    json: Record<string, unknown>;
  };
  extractedTextPreview: string;
  extractedTextLength: number;
};
type ErrorResponse = {
  ok: false;
  stage: string;
  elapsedMs: number;
  stages?: Stage[];
  error: unknown;
};
type Response = SuccessResponse | ErrorResponse;

export default function TestProcessPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Response | null>(null);
  const [t0, setT0] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setResp(null);
    setElapsed(null);
    setT0(Date.now());
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/dev-test/process", {
        method: "POST",
        body: fd,
      });
      const json = (await r.json()) as Response;
      setResp(json);
    } catch (e) {
      setResp({
        ok: false,
        stage: "client",
        elapsedMs: 0,
        error: (e as Error).message,
      });
    } finally {
      setBusy(false);
      setElapsed(t0 ? Date.now() - t0 : null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "32px auto",
        padding: "0 20px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Credit Report — Extraction Probe</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Runs the new Mistral OCR + AI paralegal pipeline. No auth, no Convex.
        Dev only.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginTop: 24,
          background: "#fafafa",
        }}
      >
        <input
          type="file"
          accept=".pdf,.html,.htm,.json,.txt,application/pdf,text/html,application/json,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <button
          onClick={run}
          disabled={!file || busy}
          style={{
            marginLeft: 12,
            padding: "8px 16px",
            border: "none",
            borderRadius: 6,
            background: busy ? "#999" : "#1f6feb",
            color: "white",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Processing…" : "Process"}
        </button>
        {file && (
          <span style={{ marginLeft: 12, color: "#666", fontSize: 13 }}>
            {file.name} — {(file.size / 1024).toFixed(1)} KB
          </span>
        )}
        {busy && (
          <p style={{ color: "#666", marginTop: 12 }}>
            Big PDFs can take 1–3 minutes (Mistral OCR + paralegal).
          </p>
        )}
      </div>

      {resp && (
        <div style={{ marginTop: 24 }}>
          {resp.ok ? (
            <SuccessView data={resp} />
          ) : (
            <FailureView data={resp} />
          )}
        </div>
      )}
    </main>
  );
}

function SuccessView({ data }: { data: SuccessResponse }) {
  return (
    <>
      <div
        style={{
          border: "1px solid #2da44e",
          background: "#e6f4ea",
          padding: 16,
          borderRadius: 8,
        }}
      >
        <strong>OK</strong> — extracted in {(data.elapsedMs / 1000).toFixed(1)} s.
        Confidence: <strong>{data.result.confidence}</strong>.
      </div>

      <h2 style={{ marginTop: 24 }}>Counts</h2>
      <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
        <tbody>
          {Object.entries(data.result.counts).map(([k, v]) => (
            <tr key={k}>
              <td
                style={{
                  padding: "4px 12px 4px 0",
                  color: "#666",
                  fontWeight: 500,
                }}
              >
                {k}
              </td>
              <td style={{ padding: "4px 0", fontVariantNumeric: "tabular-nums" }}>
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.result.reasonCodes.length > 0 && (
        <p style={{ color: "#995900", marginTop: 8 }}>
          reasonCodes: {data.result.reasonCodes.join(", ")}
        </p>
      )}

      <h2 style={{ marginTop: 24 }}>Stages</h2>
      <ol style={{ fontSize: 13, color: "#444" }}>
        {data.stages.map((s, i) => (
          <li key={i}>
            <strong>{s.event}</strong>
            {s.data && (
              <span style={{ color: "#666", marginLeft: 8 }}>
                {JSON.stringify(s.data)}
              </span>
            )}
          </li>
        ))}
      </ol>

      <h2 style={{ marginTop: 24 }}>Borrower</h2>
      <pre style={preStyle}>
        {JSON.stringify(
          (data.result.json as { borrower?: unknown }).borrower,
          null,
          2,
        )}
      </pre>

      <h2 style={{ marginTop: 24 }}>
        Tradelines (first 5 of{" "}
        {(data.result.json.tradelines as unknown[] | undefined)?.length ?? 0})
      </h2>
      <pre style={preStyle}>
        {JSON.stringify(
          (data.result.json.tradelines as unknown[] | undefined)?.slice(0, 5) ??
            [],
          null,
          2,
        )}
      </pre>

      <h2 style={{ marginTop: 24 }}>
        Collections (
        {(data.result.json.collections as unknown[] | undefined)?.length ?? 0})
      </h2>
      <pre style={preStyle}>
        {JSON.stringify(
          (data.result.json.collections as unknown[] | undefined) ?? [],
          null,
          2,
        )}
      </pre>

      <h2 style={{ marginTop: 24 }}>
        Inquiries (
        {(data.result.json.inquiries as unknown[] | undefined)?.length ?? 0})
      </h2>
      <pre style={preStyle}>
        {JSON.stringify(
          (data.result.json.inquiries as unknown[] | undefined) ?? [],
          null,
          2,
        )}
      </pre>

      <h2 style={{ marginTop: 24 }}>
        Cleaned OCR / text preview ({data.extractedTextLength} chars total —
        first 2000 shown)
      </h2>
      <pre style={{ ...preStyle, maxHeight: 320, overflow: "auto" }}>
        {data.extractedTextPreview}
      </pre>
    </>
  );
}

function FailureView({ data }: { data: ErrorResponse }) {
  return (
    <>
      <div
        style={{
          border: "1px solid #d1242f",
          background: "#fde8e8",
          padding: 16,
          borderRadius: 8,
        }}
      >
        <strong>Failed at stage: {data.stage}</strong> after{" "}
        {(data.elapsedMs / 1000).toFixed(1)} s
      </div>
      <h2 style={{ marginTop: 24 }}>Error</h2>
      <pre style={preStyle}>{JSON.stringify(data.error, null, 2)}</pre>
      {data.stages && data.stages.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Stages completed before failure</h2>
          <ol style={{ fontSize: 13 }}>
            {data.stages.map((s, i) => (
              <li key={i}>
                <strong>{s.event}</strong>{" "}
                {s.data && (
                  <span style={{ color: "#666" }}>{JSON.stringify(s.data)}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

const preStyle: React.CSSProperties = {
  background: "#0d1117",
  color: "#e6edf3",
  padding: 12,
  borderRadius: 6,
  fontSize: 12,
  overflowX: "auto",
};
