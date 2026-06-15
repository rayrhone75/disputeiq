// Credential vault — encrypts stored provider logins for "remember login".
//
// Uses a SEPARATE key from the report-payload ENCRYPTION_KEY so the blast
// radius of a leak is isolated: CREDIT_CONNECTOR_VAULT_KEY only ever
// protects reusable provider credentials. AES-256-GCM, same envelope
// format as lib/encryption.ts: base64( iv[12] | tag[16] | ciphertext ).
//
// Credentials are encrypted here in the Node runtime and only the
// ciphertext is ever sent to Convex — the plaintext password never
// touches the database or any log.

import crypto from "node:crypto";
import { ConnectorError } from "./types";
import type { ConnectorCredentials } from "./types";

const ALGO = "aes-256-gcm";

function vaultKey(): Buffer {
  const k = process.env.CREDIT_CONNECTOR_VAULT_KEY ?? "";
  if (k.length < 32) {
    throw new ConnectorError(
      "CONFIG_ERROR",
      "Saving your login isn't available right now. (Server vault key not configured.)",
    );
  }
  return crypto.createHash("sha256").update(k).digest();
}

export function vaultConfigured(): boolean {
  return (process.env.CREDIT_CONNECTOR_VAULT_KEY ?? "").length >= 32;
}

export function encryptCredentials(creds: ConnectorCredentials): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, vaultKey(), iv);
  const plain = JSON.stringify(creds);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptCredentials(payload: string): ConnectorCredentials {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, vaultKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(enc),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain) as ConnectorCredentials;
}

/** Non-sensitive hints stored alongside the ciphertext for the UI. */
export function credentialHints(creds: ConnectorCredentials): {
  usernameHint: string;
  ssnLast4Hint?: string;
} {
  const u = creds.username ?? "";
  const usernameHint =
    u.length <= 2 ? "••" : `${u.slice(0, 2)}${"•".repeat(Math.min(u.length - 2, 6))}`;
  return {
    usernameHint,
    ssnLast4Hint: creds.last4SSN ? `••${creds.last4SSN.slice(-2)}` : undefined,
  };
}
