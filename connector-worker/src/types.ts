// Shared types for the connector worker.

export type ProviderId = "MYSCOREIQ" | "MYFREESCORENOW";

export type Credentials = {
  username: string;
  password: string;
  last4SSN?: string;
};

export type ConnectorErrorCode =
  | "BAD_CREDENTIALS"
  | "MFA_REQUIRED"
  | "CAPTCHA"
  | "ACCOUNT_LOCKED"
  | "LAYOUT_CHANGED"
  | "REPORT_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "UNKNOWN";

export class ConnectorError extends Error {
  code: ConnectorErrorCode;
  userMessage: string;
  constructor(code: ConnectorErrorCode, userMessage: string) {
    super(`${code}: ${userMessage}`);
    this.name = "ConnectorError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export type Checks = {
  loginPageFound: boolean;
  usernameFieldFound: boolean;
  passwordFieldFound: boolean;
  ssnFieldFound: boolean;
  mfaChallenge: boolean;
  captcha: boolean;
  accountLocked: boolean;
  reportPageReached: boolean;
  downloadPageFound: boolean;
};

export function emptyChecks(): Checks {
  return {
    loginPageFound: false,
    usernameFieldFound: false,
    passwordFieldFound: false,
    ssnFieldFound: false,
    mfaChallenge: false,
    captcha: false,
    accountLocked: false,
    reportPageReached: false,
    downloadPageFound: false,
  };
}

export type Screenshot = { name: string; dataUrl: string; savedPath?: string };

export type LogEntry = {
  ts: number;
  stage: string;
  ok: boolean;
  detail?: Record<string, unknown>;
};

export type ProviderStatus = "GREEN" | "YELLOW" | "RED";

export type FetchedReport =
  | { kind: "html"; html: string }
  | { kind: "pdf"; pdfBase64: string; filename: string };

export type ImportResult = {
  ok: boolean;
  provider: ProviderId;
  fetched?: FetchedReport;
  checks: Checks;
  log: LogEntry[];
  error?: { code: ConnectorErrorCode; message: string };
};

export type TestResult = {
  provider: ProviderId;
  status: ProviderStatus;
  checks: Checks;
  screenshots: Screenshot[];
  log: LogEntry[];
  error?: { code: ConnectorErrorCode; message: string };
  finishedAt: number;
};
