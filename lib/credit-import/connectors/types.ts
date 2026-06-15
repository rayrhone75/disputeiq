// Connector type taxonomy: credentials, error codes, results, logs.

import type { ConnectorProviderId } from "./config";

export type ConnectorCredentials = {
  username: string;
  password: string;
  // Required by MyScoreIQ / IdentityIQ; optional for others.
  last4SSN?: string;
};

/**
 * Stable error codes the UI keys retry/help messaging off of. Every
 * connector failure maps to exactly one of these — never a raw stack.
 */
export type ConnectorErrorCode =
  | "BAD_CREDENTIALS" // username/password rejected
  | "MFA_REQUIRED" // provider asked for a one-time code / 2FA
  | "CAPTCHA" // provider showed a captcha / bot check
  | "ACCOUNT_LOCKED" // too many attempts / locked
  | "LAYOUT_CHANGED" // expected element not found — selectors drifted
  | "REPORT_UNAVAILABLE" // logged in but no report could be retrieved
  | "PROVIDER_TIMEOUT" // navigation/login timed out
  | "NOT_IMPLEMENTED" // provider connector not built yet
  | "BROWSER_UNAVAILABLE" // playwright/chromium not installed on the server
  | "CONFIG_ERROR" // missing env (vault key, etc.)
  | "UNKNOWN";

/** Whether the user can fix this by retrying / supplying more input. */
export function isRetryable(code: ConnectorErrorCode): boolean {
  return (
    code === "MFA_REQUIRED" ||
    code === "CAPTCHA" ||
    code === "BAD_CREDENTIALS" ||
    code === "PROVIDER_TIMEOUT"
  );
}

export class ConnectorError extends Error {
  code: ConnectorErrorCode;
  // Customer-safe guidance (never contains secrets or stack traces).
  userMessage: string;
  retryable: boolean;
  constructor(
    code: ConnectorErrorCode,
    userMessage: string,
    opts?: { cause?: unknown },
  ) {
    super(`${code}: ${userMessage}`);
    this.name = "ConnectorError";
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = isRetryable(code);
    if (opts?.cause) (this as { cause?: unknown }).cause = opts.cause;
  }
}

/** A single redacted step in the session log (no PII / secrets). */
export type SessionLogEntry = {
  ts: number;
  stage: string;
  ok: boolean;
  detail?: Record<string, unknown>;
};

/** What the browser automation hands back: the raw report bytes/text. */
export type ConnectorFetchResult =
  | { kind: "html"; html: string }
  | { kind: "pdf"; pdf: Buffer; filename: string }
  | { kind: "text"; text: string };

export type ConnectorRunResult = {
  provider: ConnectorProviderId;
  fetched: ConnectorFetchResult;
  log: SessionLogEntry[];
};
