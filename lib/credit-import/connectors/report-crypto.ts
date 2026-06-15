// Encryption for connector report drafts.
//
// Uses CREDIT_REPORT_ENCRYPTION_KEY so connector-pulled report data has
// its own key, isolated from the general ENCRYPTION_KEY. Falls back to
// ENCRYPTION_KEY when the dedicated key isn't set, so the feature still
// works in environments that only configured the base key. Same
// AES-256-GCM envelope as lib/encryption.ts.

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function reportKey(): Buffer {
  const k =
    process.env.CREDIT_REPORT_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? "";
  if (k.length < 32) {
    throw new Error(
      "CREDIT_REPORT_ENCRYPTION_KEY (or ENCRYPTION_KEY) must be >= 32 chars",
    );
  }
  return crypto.createHash("sha256").update(k).digest();
}

export function reportEncryptionConfigured(): boolean {
  const k =
    process.env.CREDIT_REPORT_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? "";
  return k.length >= 32;
}

export function encryptReport(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, reportKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptReport(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, reportKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
