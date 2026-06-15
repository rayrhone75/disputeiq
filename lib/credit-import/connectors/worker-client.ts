// Client for the connector-worker service.
//
// Playwright runs on a separate VPS/container (see connector-worker/).
// The Vercel app NEVER launches a browser — it calls this worker's API
// over HTTPS with a shared bearer secret. All functions here fail closed:
// a missing config or an unreachable worker maps to a clean error, never
// a thrown stack to the customer.

import type { ConnectorProviderId } from "./config";

const WORKER_URL = () => (process.env.CONNECTOR_WORKER_URL ?? "").replace(/\/$/, "");
const WORKER_SECRET = () => process.env.CONNECTOR_WORKER_SECRET ?? "";

export function workerConfigured(): boolean {
  return WORKER_URL().length > 0 && WORKER_SECRET().length > 0;
}

export type WorkerChecks = {
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

export type WorkerFetched =
  | { kind: "html"; html: string }
  | { kind: "pdf"; pdfBase64: string; filename: string };

export type WorkerImportResult = {
  ok: boolean;
  provider: ConnectorProviderId;
  fetched?: WorkerFetched;
  checks: WorkerChecks;
  log: Array<{ ts: number; stage: string; ok: boolean; detail?: unknown }>;
  error?: { code: string; message: string };
};

export type WorkerScreenshot = { name: string; dataUrl: string };

export type WorkerTestResult = {
  provider: ConnectorProviderId;
  status: "GREEN" | "YELLOW" | "RED";
  checks: WorkerChecks;
  screenshots: WorkerScreenshot[];
  log: Array<{ ts: number; stage: string; ok: boolean; detail?: unknown }>;
  error?: { code: string; message: string };
  finishedAt: number;
};

export type WorkerHealth = {
  provider: ConnectorProviderId;
  label?: string;
  status: "GREEN" | "YELLOW" | "RED";
  checks: WorkerChecks;
};

class WorkerUnavailable extends Error {}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs?: number },
): Promise<T> {
  if (!workerConfigured()) {
    throw new WorkerUnavailable("CONNECTOR_WORKER_URL / SECRET not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 180_000);
  try {
    const res = await fetch(`${WORKER_URL()}${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${WORKER_SECRET()}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new WorkerUnavailable(`worker responded ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof WorkerUnavailable) throw err;
    throw new WorkerUnavailable((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

export async function workerImport(input: {
  provider: ConnectorProviderId;
  credentials: { username: string; password: string; last4SSN?: string };
  mfaCode?: string;
}): Promise<WorkerImportResult> {
  return call<WorkerImportResult>("/v1/import", { method: "POST", body: input });
}

export async function workerTest(input: {
  provider: ConnectorProviderId;
  credentials: { username: string; password: string; last4SSN?: string };
  mfaCode?: string;
}): Promise<WorkerTestResult> {
  return call<WorkerTestResult>("/v1/test", {
    method: "POST",
    body: input,
    timeoutMs: 180_000,
  });
}

export async function workerHealth(): Promise<{ providers: WorkerHealth[] }> {
  return call<{ providers: WorkerHealth[] }>("/v1/health", {
    method: "GET",
    timeoutMs: 60_000,
  });
}

export { WorkerUnavailable };
