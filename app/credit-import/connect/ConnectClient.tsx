"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONNECTOR_PROVIDERS,
  type ConnectorProviderId,
} from "@/lib/credit-import/connectors/config";

type Preview = {
  provider: string;
  confidence: string;
  counts: {
    tradelines: number;
    inquiries: number;
    collections: number;
    publicRecords: number;
  };
  consumerName: string | null;
  sampleCreditors: string[];
  reasonCodes: string[];
};

type PreviewResponse =
  | { ok: true; sessionId: string; preview: Preview; savedLogin: boolean }
  | { ok: false; sessionId?: string; error: string; message: string; retryable?: boolean };

type Phase = "form" | "running" | "preview" | "saving" | "error";

export function ConnectClient({ providerId }: { providerId: ConnectorProviderId }) {
  const router = useRouter();
  const def = CONNECTOR_PROVIDERS[providerId];
  const requiresSsn = def.fields.includes("last4SSN");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [last4SSN, setLast4SSN] = useState("");
  const [consent, setConsent] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  function resetForRetry() {
    setPhase("form");
    setError("");
    setPreview(null);
  }

  async function startImport() {
    setError("");
    if (!consent) return setError("Please check the consent box to continue.");
    if (!username || !password) return setError("Enter your username and password.");
    if (requiresSsn && !/^\d{4}$/.test(last4SSN))
      return setError("Enter the last 4 digits of your SSN.");

    setPhase("running");
    try {
      const res = await fetch("/api/credit-import/connect/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          consent: true,
          rememberLogin,
          mfaCode: needsMfa && mfaCode ? mfaCode : undefined,
          credentials: { username, password, last4SSN: last4SSN || undefined },
        }),
      });
      const data = (await res.json()) as PreviewResponse;
      if (data.ok) {
        setSessionId(data.sessionId);
        setPreview(data.preview);
        setNeedsMfa(false);
        setPhase("preview");
        return;
      }
      setError(data.message || "Import failed.");
      if (data.error === "MFA_REQUIRED") {
        setNeedsMfa(true);
        setPhase("form");
      } else {
        setPhase("error");
      }
    } catch (err) {
      setPhase("error");
      setError(`Network error — please try again. (${(err as Error).message})`);
    }
  }

  async function saveImport() {
    if (!sessionId) return;
    setPhase("saving");
    setError("");
    try {
      const res = await fetch("/api/credit-import/connect/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json()) as { ok: boolean; redirectTo?: string; message?: string };
      if (data.ok) {
        router.push(data.redirectTo ?? "/dashboard/get-report?imported=1");
        return;
      }
      setPhase("error");
      setError(data.message ?? "Couldn't save your report.");
    } catch (err) {
      setPhase("error");
      setError(`Network error — please try again. (${(err as Error).message})`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        Import from {def.label}
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        We&apos;ll securely sign in to your {def.label} account and pull your
        latest 3-bureau report. Your login is used only for this import.
      </p>

      {phase === "preview" && preview ? (
        <PreviewCard preview={preview} onConfirm={saveImport} onCancel={resetForRetry} />
      ) : phase === "saving" ? (
        <Busy label="Saving your report…" />
      ) : phase === "running" ? (
        <Busy label={`Securely signing in to ${def.label} and pulling your report… up to a minute.`} />
      ) : (
        <section className="mt-8 space-y-5 rounded-2xl border border-default bg-surface/60 p-6">
          <Field label={def.usernameLabel} value={username} onChange={setUsername} autoComplete="off" />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="off" />
          {requiresSsn && (
            <Field
              label="Last 4 of SSN"
              value={last4SSN}
              onChange={(v) => setLast4SSN(v.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              hint={last4SSN.length === 4 ? `Will be stored masked as ***-**-${last4SSN}` : undefined}
            />
          )}
          {needsMfa && (
            <Field
              label="Verification code"
              value={mfaCode}
              onChange={(v) => setMfaCode(v.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric"
              hint={`${def.label} sent you a one-time code. Enter it to finish signing in.`}
            />
          )}

          <label className="flex items-start gap-3 text-sm text-fg-muted">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>
              I authorize DisputeIQ to access {def.label} on my behalf to
              retrieve <strong>my own</strong> credit report for this import.
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm text-fg-muted">
            <input type="checkbox" checked={rememberLogin} onChange={(e) => setRememberLogin(e.target.checked)} />
            <span>Remember my login (encrypted) for faster future imports.</span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={startImport}
            className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
          >
            {needsMfa ? "Submit code & import" : "Import my report"}
          </button>

          <p className="text-xs text-fg-muted">
            We never store your password unless you check &quot;remember
            login.&quot; Stored logins are encrypted; your SSN is shown only as
            ***-**-1234.
          </p>
        </section>
      )}

      {phase === "error" && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={resetForRetry} className="mt-3 rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg">
            Try again
          </button>
        </div>
      )}
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-fg">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        className="mt-1 w-full rounded-xl border border-default bg-bg px-3 py-2 text-fg"
      />
      {props.hint && <span className="mt-1 block text-xs text-fg-muted">{props.hint}</span>}
    </label>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-default bg-surface/60 p-10 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      <p className="text-sm text-fg-muted">{label}</p>
    </div>
  );
}

function PreviewCard({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: Preview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = preview.counts;
  return (
    <section className="mt-8 rounded-2xl border border-default bg-surface/60 p-6">
      <h2 className="text-lg font-semibold text-fg">Review before saving</h2>
      {preview.consumerName && (
        <p className="mt-1 text-sm text-fg-muted">
          Report for <strong>{preview.consumerName}</strong>
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tradelines" value={c.tradelines} />
        <Stat label="Collections" value={c.collections} />
        <Stat label="Inquiries" value={c.inquiries} />
        <Stat label="Public records" value={c.publicRecords} />
      </div>
      {preview.sampleCreditors.length > 0 && (
        <p className="mt-4 text-sm text-fg-muted">
          Accounts found: {preview.sampleCreditors.join(", ")}
          {preview.counts.tradelines > preview.sampleCreditors.length ? "…" : ""}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={onConfirm} className="flex-1 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700">
          Save &amp; continue
        </button>
        <button onClick={onCancel} className="rounded-xl border border-default px-5 py-3 font-medium text-fg">
          Cancel
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-default bg-bg p-3 text-center">
      <div className="text-2xl font-semibold text-fg">{value}</div>
      <div className="text-xs text-fg-muted">{label}</div>
    </div>
  );
}
