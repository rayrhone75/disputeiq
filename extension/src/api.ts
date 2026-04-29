// Typed DisputeIQ API client used by the extension's background worker
// and popup. Origin is baked at build time via the DISPUTEIQ_ORIGIN
// define (see extension/build.mjs).

declare const DISPUTEIQ_ORIGIN: string;

export const API_ORIGIN = DISPUTEIQ_ORIGIN;
const EXT_VERSION = chrome.runtime.getManifest().version;

export type PairCompleteResult =
  | {
      ok: true;
      extensionToken: string;
      expiresAt: number;
      pairingId: string;
      user: { email: string };
    }
  | { ok: false; code: string; message: string };

export async function pairComplete(
  pairToken: string,
): Promise<PairCompleteResult> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/extension/pair/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairToken,
        extensionVersion: EXT_VERSION,
        userAgent: navigator.userAgent,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: (err as Error).message,
    };
  }
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      code: "BAD_RESPONSE",
      message: `HTTP ${res.status}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: String(body.code ?? body.error ?? `HTTP_${res.status}`),
      message: String(body.message ?? "Pair failed."),
    };
  }
  return {
    ok: true,
    extensionToken: String(body.extensionToken),
    expiresAt: Number(body.expiresAt),
    pairingId: String(body.pairingId),
    user: (body.user as { email: string }) ?? { email: "" },
  };
}

export type StatusResult =
  | {
      ok: true;
      pairingId: string;
      pairedAt: number;
      expiresAt: number;
      lastImportAt: number | null;
      lastError: string | null;
      user: { email: string } | null;
    }
  | { ok: false; code: string; message: string };

export async function getStatus(token: string): Promise<StatusResult> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/extension/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: (err as Error).message,
    };
  }
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      code: "BAD_RESPONSE",
      message: `HTTP ${res.status}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: String(body.code ?? body.error ?? `HTTP_${res.status}`),
      message: String(body.message ?? "Status check failed."),
    };
  }
  return body as Extract<StatusResult, { ok: true }>;
}

export type ImportResult =
  | {
      ok: true;
      importId: string;
      tradelineCount: number;
      candidatesCreated: number;
      counts: {
        tradelines: number;
        inquiries: number;
        collections: number;
        publicRecords: number;
        candidates: number;
      };
      redirect: string;
    }
  | { ok: false; code: string; message: string; importId?: string };

export async function importMyScoreIqJson(
  token: string,
  bodyText: string,
): Promise<ImportResult> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/api/extension/import/myscoreiq`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        "X-Extension-Version": EXT_VERSION,
      },
      body: bodyText,
    });
  } catch (err) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: (err as Error).message,
    };
  }
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      code: "BAD_RESPONSE",
      message: `HTTP ${res.status}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: String(body.code ?? body.error ?? `HTTP_${res.status}`),
      message: String(body.message ?? "Import failed."),
      importId: body.importId ? String(body.importId) : undefined,
    };
  }
  return body as Extract<ImportResult, { ok: true }>;
}

export const dashboardUrlFor = (path: string): string =>
  `${API_ORIGIN}${path}`;
