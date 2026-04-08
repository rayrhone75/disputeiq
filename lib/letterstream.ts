// LetterStream adapter — Monetization Mode.
//
// Business model: WE pay LetterStream wholesale, we charge our user retail via
// Square. Users never see LetterStream. All jobs use our master account.
//
// Auth: LETTERSTREAM_API_ID + LETTERSTREAM_API_KEY (personal account today,
// switch to a business account later — no code changes required).
//
// Mode: LETTERSTREAM_MODE = "test" | "production". Default "test" so we can
// never accidentally drop real mail before flipping the switch.
//
// Payload mode: LETTERSTREAM_PAYLOAD_MODE = "file_ref" | "base64" | "upload_url".
// We default to base64 because it works against any account configuration
// without preconfigured file upload endpoints. Override once your account-
// specific docs are confirmed.
//
// Retry: built-in exponential backoff for transient network failures. We do
// NOT retry 4xx responses — those mean the payload is wrong, not transient.
import { storage } from "@/lib/storage";

const LS_BASE = process.env.LETTERSTREAM_API_BASE ?? "https://www.letterstream.com/apis/";
type PayloadMode = "file_ref" | "base64" | "upload_url";

export type LetterstreamMode = "test" | "production";

export interface LetterstreamSubmitInput {
  securePdfRef: string;
  certified: boolean;
  err: boolean;
  metadata?: Record<string, string>;
}

export interface LetterstreamJob {
  jobId: string;
  status: "submitted" | "delivered" | "failed";
  mode: LetterstreamMode;
  securePdfRef: string;
  certified: boolean;
  err: boolean;
  metadata?: Record<string, string>;
  rawResponse?: unknown;
}

function currentMode(): LetterstreamMode {
  return (process.env.LETTERSTREAM_MODE ?? "test") as LetterstreamMode;
}

async function buildPayload(input: LetterstreamSubmitInput) {
  const payloadMode = (process.env.LETTERSTREAM_PAYLOAD_MODE ?? "base64") as PayloadMode;
  const base = {
    api_id: process.env.LETTERSTREAM_API_ID,
    api_key: process.env.LETTERSTREAM_API_KEY,
    mode: currentMode(),
    certified: input.certified ? 1 : 0,
    return_receipt: input.err ? 1 : 0,
    metadata: input.metadata ?? {},
  };

  if (payloadMode === "base64") {
    const buf = await storage.get(input.securePdfRef).catch(() => null);
    if (buf) return { ...base, file_base64: buf.toString("base64") };
    return { ...base, file_ref: input.securePdfRef };
  }
  if (payloadMode === "upload_url") {
    const url = await storage.signedUrl(input.securePdfRef, 600).catch(() => input.securePdfRef);
    return { ...base, file_url: url };
  }
  return { ...base, file_ref: input.securePdfRef };
}

// Returns a safe-to-log shape of the payload with secrets redacted and large
// binary fields summarized. Never logs api_id, api_key, or full base64.
function redactForLog(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  const out: any = { ...payload };
  if ("api_id" in out) out.api_id = out.api_id ? "[REDACTED]" : null;
  if ("api_key" in out) out.api_key = out.api_key ? "[REDACTED]" : null;
  if ("file_base64" in out && typeof out.file_base64 === "string") {
    out.file_base64 = `[base64 ${out.file_base64.length} chars]`;
  }
  return out;
}

async function submitOnce(payload: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(`${LS_BASE}submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e?.message ?? e) } };
  }
}

export async function sendLetterstreamJob(input: LetterstreamSubmitInput): Promise<LetterstreamJob> {
  const apiId = process.env.LETTERSTREAM_API_ID;
  const apiKey = process.env.LETTERSTREAM_API_KEY;
  const mode = currentMode();

  // Local-dev fallback: no creds means mock submit (preserves the dev loop).
  if (!apiId || !apiKey) {
    return {
      jobId: "ls_mock_" + Date.now(),
      status: "submitted",
      mode,
      ...input,
    };
  }

  const payload = await buildPayload(input);

  // Debug logging — payload shape only, secrets redacted, base64 summarized.
  // Helpful while we're still confirming exact account field names.
  console.log(
    "[letterstream] submit",
    JSON.stringify({
      mode,
      payload_mode: process.env.LETTERSTREAM_PAYLOAD_MODE ?? "base64",
      shape: redactForLog(payload),
      metadata: input.metadata,
    }),
  );

  // Retry transient failures (network errors and 5xx) with exponential backoff.
  const maxAttempts = 3;
  let last: { ok: boolean; status: number; data: any } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await submitOnce(payload);
    if (last.ok) break;
    const transient = last.status === 0 || last.status >= 500;
    if (!transient) break;
    if (attempt < maxAttempts) {
      const delay = 250 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (!last || !last.ok) {
    console.warn("[letterstream] submit failed", { status: last?.status, data: last?.data });
    return {
      jobId: "ls_pending_" + Date.now(),
      status: "failed",
      mode,
      ...input,
      rawResponse: last?.data,
    };
  }

  const data = last.data;
  console.log("[letterstream] submit ok", { status: last.status, jobIdHint: data?.job_id ?? data?.jobId ?? data?.id });
  return {
    jobId: String(data?.job_id ?? data?.jobId ?? data?.id ?? "ls_" + Date.now()),
    status: "submitted",
    mode,
    ...input,
    rawResponse: data,
  };
}
