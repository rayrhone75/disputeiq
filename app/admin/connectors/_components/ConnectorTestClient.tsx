"use client";

import { useState } from "react";

type Checks = {
  loginPageFound: boolean;
  usernameFieldFound: boolean;
  passwordFieldFound: boolean;
  ssnFieldFound: boolean;
  mfaChallenge: boolean;
  captcha: boolean;
  accountLocked: boolean;
  reportPageReached: boolean;
  downloadPageFound: boolean;
};

type TestResult = {
  provider: string;
  status: "GREEN" | "YELLOW" | "RED";
  checks: Checks;
  screenshots: { name: string; dataUrl: string }[];
  log: { ts: number; stage: string; ok: boolean }[];
  error?: { code: string; message: string };
};

const CHECK_LABELS: { key: keyof Checks; label: string }[] = [
  { key: "loginPageFound", label: "Login page found" },
  { key: "usernameFieldFound", label: "Username field found" },
  { key: "passwordFieldFound", label: "Password field found" },
  { key: "ssnFieldFound", label: "SSN field found" },
  { key: "mfaChallenge", label: "MFA challenge" },
  { key: "captcha", label: "Captcha" },
  { key: "accountLocked", label: "Account locked" },
  { key: "reportPageReached", label: "Report page reached" },
  { key: "downloadPageFound", label: "Download page found" },
];

export function ConnectorTestClient({
  providerId,
  providerLabel,
}: {
  providerId: string;
  providerLabel: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [last4SSN, setLast4SSN] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/connectors/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          username,
          password,
          last4SSN: last4SSN || undefined,
          mfaCode: mfaCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data.result as TestResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-fg">
        {providerLabel} connector — live test
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        Runs a real Playwright session on the connector worker with the test
        credentials below, captures screenshots at each step, and reports
        GREEN / YELLOW / RED. Credentials are used for this run only.
      </p>

      <section className="mt-6 grid gap-4 rounded-2xl border border-default bg-surface/60 p-5">
        <TestField label="Test username" value={username} onChange={setUsername} />
        <TestField label="Test password" value={password} onChange={setPassword} type="password" />
        <TestField
          label="Last 4 SSN (optional)"
          value={last4SSN}
          onChange={(v) => setLast4SSN(v.replace(/\D/g, "").slice(0, 4))}
        />
        <TestField
          label="MFA code (optional)"
          value={mfaCode}
          onChange={(v) => setMfaCode(v.replace(/\D/g, "").slice(0, 12))}
        />
        <button
          onClick={run}
          disabled={running || !username || !password}
          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {running ? "Running live session…" : "Run live test"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="mt-8 space-y-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={result.status} />
            {result.error && (
              <span className="text-sm text-fg-muted">
                {result.error.code}: {result.error.message}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Detection
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CHECK_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-default bg-bg px-3 py-2 text-sm"
                >
                  <span>{result.checks[key] ? "✅" : "⬜"}</span>
                  <span className="text-fg">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {result.screenshots.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
                Screenshots
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.screenshots.map((s) => (
                  <figure key={s.name} className="rounded-xl border border-default p-2">
                    <figcaption className="mb-2 text-xs font-medium text-fg-muted">
                      {s.name}
                    </figcaption>
                    {s.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.dataUrl} alt={s.name} className="w-full rounded-lg" />
                    ) : (
                      <div className="py-8 text-center text-xs text-fg-muted">no image</div>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              Session log (sanitized)
            </h2>
            <ul className="mt-3 space-y-1 rounded-xl border border-default bg-bg p-3 text-xs text-fg-muted">
              {result.log.map((e, i) => (
                <li key={i}>
                  {e.ok ? "•" : "✕"} {e.stage}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

function TestField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-fg">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-default bg-bg px-3 py-2 text-fg"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: "GREEN" | "YELLOW" | "RED" }) {
  const map = {
    GREEN: { bg: "bg-emerald-100 text-emerald-800", label: "GREEN · working" },
    YELLOW: { bg: "bg-amber-100 text-amber-800", label: "YELLOW · needs attention / MFA" },
    RED: { bg: "bg-red-100 text-red-800", label: "RED · selector broken / unreachable" },
  }[status];
  return (
    <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${map.bg}`}>
      {map.label}
    </span>
  );
}
