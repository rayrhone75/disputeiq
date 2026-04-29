// Signed tokens for the DisputeIQ Chrome extension.
//
// Two distinct token purposes are supported:
//
//   "extension-pair"   — Short-lived (5 min), single-use. Issued by
//                        DisputeIQ when a logged-in user clicks
//                        "Pair Extension". The user pastes a derived
//                        6-letter code into the extension popup; the
//                        extension calls /api/extension/pair/complete
//                        with the full token; the backend swaps the
//                        pair token for an extension-token.
//
//   "extension-token"  — Long-lived (90 days). Stored in chrome.storage
//                        and used as the bearer for /api/extension/*
//                        calls. Revocable via the dashboard.
//
// Both share the same signing primitive (HMAC-SHA256 over a base64url
// JSON payload, keyed by INTERNAL_SERVICE_SECRET, timing-safe compare),
// but each token's `purpose` claim is bound into the payload so a pair
// token can never be replayed against an import endpoint and vice versa.

import crypto from "node:crypto";

export type ExtensionTokenPurpose = "extension-pair" | "extension-token";

export type ExtensionTokenPayload = {
  uid: string; // Clerk user id
  purpose: ExtensionTokenPurpose;
  exp: number; // Unix seconds
  jti: string; // Unique token id; doubles as the pairing code lookup key
  pairId?: string; // Set on extension-token issuance to record which pair
  v?: number; // Token format version
};

export type ExtensionVerifyResult =
  | { ok: true; payload: ExtensionTokenPayload }
  | { ok: false; code: ExtensionVerifyError; message: string };

export type ExtensionVerifyError =
  | "MISSING_TOKEN"
  | "MALFORMED_TOKEN"
  | "INVALID_SIGNATURE"
  | "EXPIRED_TOKEN"
  | "WRONG_PURPOSE"
  | "BAD_PAYLOAD"
  | "NO_SECRET";

const TOKEN_VERSION = 1;
export const PAIR_TTL_SEC = 5 * 60; // 5 minutes
export const EXTENSION_TTL_SEC = 90 * 24 * 60 * 60; // 90 days

function getKey(): Buffer {
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not set.");
  }
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0) {
    return Buffer.from(secret, "hex");
  }
  return Buffer.from(secret, "utf8");
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

/**
 * Sign an extension token. The `purpose` is mixed into the payload (and
 * thus the signature), so a token issued for one purpose cannot be
 * validated as another.
 */
export function signExtensionToken(opts: {
  clerkUserId: string;
  purpose: ExtensionTokenPurpose;
  ttlSeconds?: number;
  pairId?: string;
}): { token: string; payload: ExtensionTokenPayload } {
  if (!opts.clerkUserId || typeof opts.clerkUserId !== "string") {
    throw new Error("clerkUserId is required.");
  }
  const ttl =
    opts.ttlSeconds ??
    (opts.purpose === "extension-pair" ? PAIR_TTL_SEC : EXTENSION_TTL_SEC);
  const payload: ExtensionTokenPayload = {
    uid: opts.clerkUserId,
    purpose: opts.purpose,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttl),
    jti: crypto.randomBytes(16).toString("hex"),
    pairId: opts.pairId,
    v: TOKEN_VERSION,
  };
  const payloadEnc = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getKey())
    .update(payloadEnc)
    .digest();
  return { token: `${payloadEnc}.${base64UrlEncode(sig)}`, payload };
}

/**
 * Verify an extension token and assert it carries the expected purpose.
 * Returns a discriminated union — never throws for normal failures.
 */
export function verifyExtensionToken(
  token: string | null | undefined,
  expectedPurpose: ExtensionTokenPurpose,
): ExtensionVerifyResult {
  if (!token || typeof token !== "string") {
    return { ok: false, code: "MISSING_TOKEN", message: "Token required." };
  }
  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) {
    return {
      ok: false,
      code: "MALFORMED_TOKEN",
      message: "Token must be <payload>.<signature>.",
    };
  }
  const payloadEnc = token.slice(0, dot);
  const sigEnc = token.slice(dot + 1);

  let key: Buffer;
  try {
    key = getKey();
  } catch (err) {
    return { ok: false, code: "NO_SECRET", message: (err as Error).message };
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(payloadEnc)
    .digest();
  let provided: Buffer;
  try {
    provided = base64UrlDecode(sigEnc);
  } catch {
    return {
      ok: false,
      code: "MALFORMED_TOKEN",
      message: "Signature is not base64url.",
    };
  }
  if (provided.length !== expected.length) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Signature mismatch.",
    };
  }
  if (!crypto.timingSafeEqual(provided, expected)) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Signature mismatch.",
    };
  }

  let payload: ExtensionTokenPayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(payloadEnc).toString("utf8"),
    ) as ExtensionTokenPayload;
  } catch {
    return {
      ok: false,
      code: "BAD_PAYLOAD",
      message: "Payload is not valid JSON.",
    };
  }

  if (
    !payload ||
    typeof payload.uid !== "string" ||
    typeof payload.purpose !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string"
  ) {
    return {
      ok: false,
      code: "BAD_PAYLOAD",
      message: "Payload is missing required claims.",
    };
  }

  if (payload.purpose !== expectedPurpose) {
    return {
      ok: false,
      code: "WRONG_PURPOSE",
      message: `Token purpose ${payload.purpose} does not match expected ${expectedPurpose}.`,
    };
  }

  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return {
      ok: false,
      code: "EXPIRED_TOKEN",
      message: "Token has expired.",
    };
  }

  return { ok: true, payload };
}

/**
 * 6-letter pairing code derived from a pair token's `jti`. Easy to read
 * over the phone or paste into the extension popup. The full token is
 * still required at /pair/complete; the code is just a lookup hint so
 * users don't have to copy a 200-char string.
 *
 * Format: 6 uppercase letters, ambiguous characters (I, O) excluded.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function deriveDisplayCodeFromJti(jti: string): string {
  const buf = crypto.createHash("sha256").update(jti).digest();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * SHA-256 of a token, hex-encoded. Used as a stable lookup key for
 * Convex `extensionPairings` rows so we never store the raw token in
 * the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
