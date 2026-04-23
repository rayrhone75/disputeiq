// PII redaction helpers. Used when logging normalization errors, capturing
// debug fingerprints, or showing previews in the admin UI. Rule of thumb:
// if a value could identify a real person, redact it before it leaves the
// persistence layer.

const SSN_FULL = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const PHONE = /\b\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DOB = /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](19|20)\d{2}\b/g;

const SENSITIVE_KEYS = new Set<string>([
  "ssn",
  "socialsecuritynumber",
  "socialsecurity",
  "dob",
  "dateofbirth",
  "birthdate",
  "fullssn",
  "accountnumber",
  "account_no",
  "accountno",
  "cardnumber",
  "routingnumber",
]);

export function maskSsnLast4(ssn?: string | null): string | undefined {
  if (!ssn) return undefined;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

export function maskAccount(acct?: string | null): string {
  if (!acct) return "••••";
  const cleaned = acct.toString().replace(/\s+/g, "");
  if (cleaned.length <= 4) return `••••${cleaned}`;
  const last4 = cleaned.slice(-4);
  return `••••${last4}`;
}

export function maskZip(zip?: string | null): string | undefined {
  if (!zip) return undefined;
  const digits = zip.replace(/\D/g, "");
  if (digits.length < 3) return "•••";
  return `${digits.slice(0, 3)}••`;
}

export function maskPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return `(•••) •••-${digits.slice(-4)}`;
}

export function redactText(s: string): string {
  return s
    .replace(SSN_FULL, "[SSN]")
    .replace(PHONE, "[PHONE]")
    .replace(EMAIL, "[EMAIL]")
    .replace(DOB, "[DOB]");
}

/**
 * Recursively deep-clone a JSON value with sensitive keys redacted.
 * Preserves shape for audit logs while guaranteeing no full SSN/DOB/account
 * number leaks into metadata.
 */
export function redactJson(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyLower = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEYS.has(keyLower)) {
        if (typeof v === "string") {
          out[k] = keyLower.endsWith("ssn") ? maskSsnLast4(v) ?? "[SSN]" : "[REDACTED]";
        } else {
          out[k] = "[REDACTED]";
        }
        continue;
      }
      out[k] = redactJson(v);
    }
    return out;
  }
  return value;
}
