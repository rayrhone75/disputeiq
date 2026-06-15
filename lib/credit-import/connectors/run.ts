// Connector run orchestrator (Vercel side).
//
// Delegates the actual browser automation to the connector-worker service
// and normalizes its response into a stable outcome the API routes
// consume. No Playwright here.

import type {
  ConnectorCredentials,
  ConnectorFetchResult,
  SessionLogEntry,
} from "./types";
import type { ConnectorProviderId } from "./config";
import { CONNECTOR_PROVIDERS } from "./config";
import {
  workerImport,
  workerConfigured,
  WorkerUnavailable,
} from "./worker-client";

export type RunConnectorInput = {
  provider: ConnectorProviderId;
  credentials: ConnectorCredentials;
  mfaCode?: string;
};

export type RunConnectorOutcome =
  | {
      ok: true;
      result: { provider: ConnectorProviderId; fetched: ConnectorFetchResult; log: SessionLogEntry[] };
    }
  | {
      ok: false;
      code: string;
      userMessage: string;
      retryable: boolean;
      log: SessionLogEntry[];
    };

const RETRYABLE = new Set([
  "MFA_REQUIRED",
  "CAPTCHA",
  "BAD_CREDENTIALS",
  "PROVIDER_TIMEOUT",
]);

export async function runConnector(
  input: RunConnectorInput,
): Promise<RunConnectorOutcome> {
  const def = CONNECTOR_PROVIDERS[input.provider];

  if (!workerConfigured()) {
    return {
      ok: false,
      code: "WORKER_UNAVAILABLE",
      userMessage:
        "Auto-import isn't available on this server yet. Please use manual upload.",
      retryable: false,
      log: [],
    };
  }

  let res;
  try {
    res = await workerImport({
      provider: input.provider,
      credentials: {
        username: input.credentials.username,
        password: input.credentials.password,
        last4SSN: input.credentials.last4SSN,
      },
      mfaCode: input.mfaCode,
    });
  } catch (err) {
    const unavailable = err instanceof WorkerUnavailable;
    return {
      ok: false,
      code: unavailable ? "WORKER_UNAVAILABLE" : "UNKNOWN",
      userMessage: unavailable
        ? `Couldn't reach the secure import service for ${def.label}. Please try again shortly or use manual upload.`
        : "Something went wrong during the secure import. Please try again.",
      retryable: true,
      log: [],
    };
  }

  const log: SessionLogEntry[] = (res.log ?? []).map((e) => ({
    ts: e.ts,
    stage: e.stage,
    ok: e.ok,
    detail: (e.detail as Record<string, unknown>) ?? undefined,
  }));

  if (!res.ok || !res.fetched) {
    const code = res.error?.code ?? "UNKNOWN";
    return {
      ok: false,
      code,
      userMessage:
        res.error?.message ??
        "We couldn't import your report automatically. Please use manual upload.",
      retryable: RETRYABLE.has(code),
      log,
    };
  }

  const fetched: ConnectorFetchResult =
    res.fetched.kind === "html"
      ? { kind: "html", html: res.fetched.html }
      : {
          kind: "pdf",
          pdf: Buffer.from(res.fetched.pdfBase64, "base64"),
          filename: res.fetched.filename,
        };

  return {
    ok: true,
    result: { provider: input.provider, fetched, log },
  };
}
