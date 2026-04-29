// Per-user signed token used by the MyScoreIQ bookmarklet.
//
// The bookmarklet runs on `member.myscoreiq.com` (the user's authenticated
// MyScoreIQ tab) and POSTs the JSON report body to DisputeIQ. There is no
// Clerk session cookie reachable from that origin, so we authenticate the
// request via a signed token baked into the bookmarklet's `javascript:` URL.
//
// Token format:
//   <base64url(payload)>.<base64url(hmac_sha256(payload, key))>
//
// Payload (JSON):
//   { "uid": "<clerk-user-id>", "exp": <unix-seconds>, "n": "<random nonce>" }
//
// Key: process.env.INTERNAL_SERVICE_SECRET (32-byte hex, already used by
// LetterStream webhook + dispatch-letter; reusing avoids introducing a new
// secret rotation surface).
//
// Verification uses crypto.timingSafeEqual to immunize against timing attacks
// (matches the pattern in lib/square.ts:53-62).

import crypto from "node:crypto";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

export type BookmarkletPayload = {
  uid: string; // Clerk user id, e.g. "user_2abc..."
  exp: number; // Unix seconds at which the token expires
  n: string; // Random nonce (8 bytes hex) so two tokens issued in the
  // same second to the same user differ
  v?: number; // Token format version, future-proofing
};

export type VerifyResult =
  | { ok: true; payload: BookmarkletPayload }
  | { ok: false; code: VerifyErrorCode; message: string };

export type VerifyErrorCode =
  | "MISSING_TOKEN"
  | "MALFORMED_TOKEN"
  | "INVALID_SIGNATURE"
  | "EXPIRED_TOKEN"
  | "BAD_PAYLOAD"
  | "NO_SECRET";

function getKey(): Buffer {
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    throw new BookmarkletTokenError(
      "NO_SECRET",
      "INTERNAL_SERVICE_SECRET is not set; cannot sign or verify bookmarklet tokens.",
    );
  }
  // Hex string in env → Buffer for HMAC. If the value isn't hex (e.g. a
  // raw base64 secret), fall back to utf8 — HMAC accepts any byte input.
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0) {
    return Buffer.from(secret, "hex");
  }
  return Buffer.from(secret, "utf8");
}

export class BookmarkletTokenError extends Error {
  readonly code: VerifyErrorCode;
  constructor(code: VerifyErrorCode, message: string) {
    super(message);
    this.name = "BookmarkletTokenError";
    this.code = code;
  }
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
 * Sign a bookmarklet token for a Clerk user.
 *
 * @param clerkUserId - Clerk subject id (e.g. "user_2abc…")
 * @param ttlSeconds  - Lifetime in seconds; defaults to 30 days.
 * @returns A `<payload>.<signature>` string safe to embed in a URL.
 */
export function signBookmarkletToken(
  clerkUserId: string,
  ttlSeconds: number = DEFAULT_TTL_SEC,
): string {
  if (!clerkUserId || typeof clerkUserId !== "string") {
    throw new BookmarkletTokenError(
      "BAD_PAYLOAD",
      "clerkUserId is required and must be a string.",
    );
  }
  const payload: BookmarkletPayload = {
    uid: clerkUserId,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds),
    n: crypto.randomBytes(8).toString("hex"),
    v: TOKEN_VERSION,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadEnc = base64UrlEncode(payloadJson);

  const key = getKey();
  const sig = crypto.createHmac("sha256", key).update(payloadEnc).digest();
  const sigEnc = base64UrlEncode(sig);

  return `${payloadEnc}.${sigEnc}`;
}

/**
 * Verify a bookmarklet token. Returns a discriminated union — never throws
 * for normal failures (caller branches on `result.ok`).
 */
export function verifyBookmarkletToken(token: string | null | undefined): VerifyResult {
  if (!token || typeof token !== "string") {
    return { ok: false, code: "MISSING_TOKEN", message: "Token is required." };
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
    return {
      ok: false,
      code: "NO_SECRET",
      message: (err as Error).message,
    };
  }

  const expectedSig = crypto
    .createHmac("sha256", key)
    .update(payloadEnc)
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigEnc);
  } catch {
    return {
      ok: false,
      code: "MALFORMED_TOKEN",
      message: "Signature is not valid base64url.",
    };
  }
  if (providedSig.length !== expectedSig.length) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Signature mismatch.",
    };
  }
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Signature mismatch.",
    };
  }

  let payload: BookmarkletPayload;
  try {
    const decoded = base64UrlDecode(payloadEnc).toString("utf8");
    payload = JSON.parse(decoded) as BookmarkletPayload;
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
    !payload.uid.length ||
    typeof payload.exp !== "number"
  ) {
    return {
      ok: false,
      code: "BAD_PAYLOAD",
      message: "Payload is missing uid or exp.",
    };
  }

  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return {
      ok: false,
      code: "EXPIRED_TOKEN",
      message: "Token has expired. Reload your DisputeIQ bookmarklet card.",
    };
  }

  return { ok: true, payload };
}
