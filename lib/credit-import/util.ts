// Shared parsing helpers used by provider adapters and the mapper.
// Keep deliberately tolerant: real-world credit reports use inconsistent
// casing, currency formats, and date styles. Never throw on bad input —
// return undefined and let the caller carry on.

import crypto from "node:crypto";

export function toBool(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["y", "yes", "true", "t", "1"].includes(s)) return true;
    if (["n", "no", "false", "f", "0"].includes(s)) return false;
  }
  return undefined;
}

export function toStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

export function toInt(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const m = v.replace(/[, $]/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return undefined;
    const n = Number(m[0]);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }
  return undefined;
}

export function toCents(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Heuristic: if it looks like cents already, keep it; else convert.
    return Math.round(v * 100) === v * 100 && Math.abs(v) >= 1000 ? Math.round(v) : Math.round(v * 100);
  }
  if (typeof v === "string") {
    const cleaned = v.replace(/[, $]/g, "");
    const m = cleaned.match(/-?\d+(?:\.\d{1,2})?/);
    if (!m) return undefined;
    const [intPart, fracPart = ""] = m[0].split(".");
    const sign = intPart.startsWith("-") ? -1 : 1;
    const intDigits = intPart.replace(/^[-+]/, "");
    const cents = parseInt(intDigits || "0", 10) * 100 + parseInt(fracPart.padEnd(2, "0").slice(0, 2) || "0", 10);
    return sign * cents;
  }
  return undefined;
}

export function toIsoDate(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : undefined;
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    // Accept MM/YYYY — common in credit reports
    const mmYY = s.match(/^(\d{1,2})[/\-](\d{4})$/);
    if (mmYY) {
      const d = new Date(Date.UTC(Number(mmYY[2]), Number(mmYY[1]) - 1, 1));
      return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
    }
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
  }
  return undefined;
}

export function toDate(v: unknown): Date | undefined {
  const iso = toIsoDate(v);
  return iso ? new Date(iso) : undefined;
}

export function pickFirst<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const v of values) if (v !== undefined && v !== null) return v;
  return undefined;
}

/**
 * Case-insensitive / punctuation-insensitive path lookup. Handy when a
 * provider changes field names across report versions ("AccountNumber" vs
 * "accountNumber" vs "account_number").
 */
export function getPath(obj: unknown, path: string[]): unknown {
  let cur: any = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    const target = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    let found: unknown = undefined;
    for (const k of Object.keys(cur)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
        found = (cur as any)[k];
        break;
      }
    }
    if (found === undefined) return undefined;
    cur = found;
  }
  return cur;
}

export function asArray<T = unknown>(v: unknown): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? (v as T[]) : [v as T];
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const helper = (val: unknown): unknown => {
    if (val === null || typeof val !== "object") return val;
    if (seen.has(val as object)) return null;
    seen.add(val as object);
    if (Array.isArray(val)) return val.map(helper);
    const keys = Object.keys(val as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = helper((val as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(helper(value));
}

/**
 * Stable fingerprint for a tradeline. Used for dedupe across re-imports and
 * for matching "the same tradeline on a different bureau".
 */
export function tradelineFingerprint(input: {
  bureau: string;
  creditorName: string;
  accountRefMasked: string;
}): string {
  const key = `${input.bureau}::${(input.creditorName || "").toLowerCase().replace(/\s+/g, " ").trim()}::${input.accountRefMasked}`;
  return sha256(key);
}
