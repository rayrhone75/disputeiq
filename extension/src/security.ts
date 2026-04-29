// Defensive helpers for sanitizing what the extension logs and what it
// considers JSON. We never log the full credit-report body; the only
// log lines that touch payload are size + first/last char, useful for
// triaging "is this actually JSON" without disclosing PII.

/**
 * Returns true if the body looks like JSON. Does NOT validate full
 * JSON — caller should JSON.parse for that. Used as a cheap gate before
 * spending bytes on a network request.
 */
export function looksLikeJson(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  return t[0] === "{" || t[0] === "[";
}

/**
 * Constant-redaction summary of a body — just length + tiny hash. Safe
 * for service-worker console logs.
 */
export function payloadSummary(body: string): string {
  const len = body.length;
  if (len === 0) return "empty";
  // Cheap non-cryptographic hash (FNV-1a) for log ID.
  let h = 0x811c9dc5;
  for (let i = 0; i < len; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${len}b#${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Redact a token to "abc…xyz" for log display. Only the first/last 4
 * chars survive; HMAC sigs are 32 bytes, so 4+4 is sub-collision risk
 * across tokens but enough for support to compare.
 */
export function redactToken(token: string | null | undefined): string {
  if (!token) return "<none>";
  if (token.length < 16) return "<short>";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
