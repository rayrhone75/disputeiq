// Session-based fetcher for provider JSON endpoints.
//
// IdentityIQ / MyScoreIQ expose the credit report JSON at a URL of the form
//   https://<provider>/.../CreditReport.aspx?view=json
// behind the logged-in user's web session. We never attempt to scrape HTML
// — the caller hands us a URL plus the session cookies that were captured
// at login (or a bearer token, if the provider supports one).
//
// This module does network-only: no parsing, no persistence. The import
// runner handles both of those steps using what we return here.

import type { FetchOptions, FetchResult } from "./types";

const DEFAULT_UA =
  "DisputeIQ-Importer/1.0 (+https://disputeiq.org; provider-adapter)";
const DEFAULT_TIMEOUT_MS = 30_000;
// Hard cap so a hostile response cannot blow up memory.
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024; // 25 MB

export class ProviderFetchError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ProviderFetchError";
    this.code = code;
    this.status = status;
  }
}

function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ProviderFetchError("BAD_URL", "Provider URL is not a valid URL.");
  }
  if (!/^https?:$/.test(u.protocol)) {
    throw new ProviderFetchError("BAD_PROTOCOL", "Only http/https URLs are allowed.");
  }
  // Defense in depth: block RFC1918 / loopback to prevent SSRF when the URL
  // is accepted from admin input.
  const host = u.hostname;
  const localish =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (localish && process.env.NODE_ENV === "production") {
    throw new ProviderFetchError(
      "UNSAFE_HOST",
      "Private-network hostnames are not allowed in production.",
    );
  }
  return u;
}

/**
 * Fetch the provider JSON body. Does not parse — downstream callers decide
 * whether to validate, store, or both. Body size is capped and the fetch is
 * wrapped in an abortable timeout.
 */
export async function fetchProviderJson(opts: FetchOptions): Promise<FetchResult> {
  const url = assertSafeUrl(opts.url);

  const headers: Record<string, string> = {
    Accept: "application/json, text/json, */*;q=0.8",
    "User-Agent": opts.userAgent ?? DEFAULT_UA,
  };
  if (opts.cookieHeader) headers["Cookie"] = opts.cookieHeader;
  if (opts.bearerToken) headers["Authorization"] = `Bearer ${opts.bearerToken}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error("timeout")), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const parentSignal = opts.signal;
  const onParentAbort = () => ac.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) ac.abort(parentSignal.reason);
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    const res = await fetch(url.toString(), { headers, signal: ac.signal, redirect: "follow" });
    const contentType = res.headers.get("content-type");
    const reader = res.body?.getReader();
    if (!reader) {
      throw new ProviderFetchError("NO_BODY", "Provider returned no response body.", res.status);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          ac.abort();
          throw new ProviderFetchError(
            "BODY_TOO_LARGE",
            `Provider response exceeded ${MAX_RESPONSE_BYTES} bytes.`,
            res.status,
          );
        }
        chunks.push(value);
      }
    }
    const bodyText = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    if (!res.ok) {
      throw new ProviderFetchError(
        "HTTP_ERROR",
        `Provider responded with HTTP ${res.status}.`,
        res.status,
      );
    }
    return {
      status: res.status,
      contentType,
      bodyText,
      sizeBytes: size,
    };
  } catch (err) {
    if (err instanceof ProviderFetchError) throw err;
    if ((err as any)?.name === "AbortError") {
      throw new ProviderFetchError("TIMEOUT", "Provider fetch timed out.");
    }
    throw new ProviderFetchError(
      "NETWORK_ERROR",
      (err as Error)?.message ?? "Unknown network error while fetching provider JSON.",
    );
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Parse the raw body as JSON. Isolated so callers can still store a failing
 * body as `raw` while recording a PARSE_ERROR.
 */
export function parseProviderJson(bodyText: string): unknown {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    throw new ProviderFetchError("EMPTY_BODY", "Provider response body was empty.");
  }
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new ProviderFetchError(
      "PARSE_ERROR",
      `Provider JSON parse failed: ${(err as Error).message}`,
    );
  }
}
