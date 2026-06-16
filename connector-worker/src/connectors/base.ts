// Base credit-monitoring connector.
//
// Subclasses (MyScoreIQConnector, MyFreeScoreNowConnector) supply
// provider metadata + selectors and may override navigation. The base
// owns the login flow, interstitial detection, screenshot capture, and
// the test/probe diagnostics. NO secret ever enters a log or screenshot
// filename — only stage labels and counts.

import fs from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import {
  ConnectorError,
  emptyChecks,
  type Checks,
  type Credentials,
  type FetchedReport,
  type ImportResult,
  type LogEntry,
  type ProviderId,
  type ProviderStatus,
  type Screenshot,
  type TestResult,
} from "../types.js";

const DIAGNOSTICS_DIR = process.env.DIAGNOSTICS_DIR ?? "./diagnostics";

class SessionLogger {
  private entries: LogEntry[] = [];
  record(stage: string, ok: boolean, detail?: Record<string, unknown>) {
    // detail is caller-controlled and must already be non-sensitive.
    this.entries.push({ ts: Date.now(), stage, ok, detail });
  }
  get() {
    return this.entries;
  }
}

export abstract class BaseConnector {
  abstract readonly id: ProviderId;
  abstract readonly label: string;
  abstract readonly loginUrl: string;
  abstract readonly requiresSsn: boolean;
  abstract readonly usernameSelectors: string[];
  abstract readonly passwordSelectors: string[];
  abstract readonly ssnSelectors: string[];
  abstract readonly submitSelectors: string[];
  abstract readonly mfaSelectors: string[];
  abstract readonly reportUrls: string[];

  // ── DOM helpers ────────────────────────────────────────────────────
  protected async firstExisting(
    page: Page,
    selectors: string[],
  ): Promise<string | null> {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) return sel;
      } catch {
        /* unsupported selector syntax — skip */
      }
    }
    return null;
  }

  protected async lowerText(page: Page): Promise<string> {
    try {
      return (await page.textContent("body"))?.toLowerCase() ?? "";
    } catch {
      return "";
    }
  }

  // ── Screenshots → diagnostics dir + base64 data URL ────────────────
  protected async capture(
    page: Page,
    sessionId: string,
    name: string,
  ): Promise<Screenshot> {
    const buf = await page.screenshot({ fullPage: false }).catch(() => null);
    if (!buf) return { name, dataUrl: "" };
    let savedPath: string | undefined;
    try {
      const dir = path.join(DIAGNOSTICS_DIR, this.id, sessionId);
      fs.mkdirSync(dir, { recursive: true });
      savedPath = path.join(dir, `${name}.png`);
      fs.writeFileSync(savedPath, buf);
    } catch {
      /* disk write is best-effort; the data URL still returns */
    }
    return {
      name,
      dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
      savedPath,
    };
  }

  // ── Interstitial detection ─────────────────────────────────────────
  protected async detectChecks(page: Page, checks: Checks): Promise<void> {
    const text = await this.lowerText(page);
    checks.captcha =
      text.includes("captcha") ||
      text.includes("are you a robot") ||
      text.includes("verify you are human");
    checks.accountLocked =
      text.includes("locked") ||
      text.includes("too many attempts") ||
      text.includes("temporarily disabled");
    const mfaText =
      text.includes("verification code") ||
      text.includes("one-time") ||
      text.includes("two-factor") ||
      text.includes("enter the code") ||
      text.includes("security code");
    const mfaField = await this.firstExisting(page, this.mfaSelectors);
    checks.mfaChallenge = mfaText || !!mfaField;
  }

  protected async assertNoBlockingInterstitial(
    page: Page,
    checks: Checks,
  ): Promise<void> {
    await this.detectChecks(page, checks);
    if (checks.captcha) {
      throw new ConnectorError(
        "CAPTCHA",
        `${this.label} asked for a captcha. Log in on their site once, then retry.`,
      );
    }
    if (checks.accountLocked) {
      throw new ConnectorError(
        "ACCOUNT_LOCKED",
        `Your ${this.label} account appears locked. Unlock it on their site, then retry.`,
      );
    }
    if (checks.mfaChallenge) {
      throw new ConnectorError(
        "MFA_REQUIRED",
        `${this.label} needs a verification code. Re-run and enter the code they send.`,
      );
    }
    const t = await this.lowerText(page);
    if (
      t.includes("incorrect") ||
      t.includes("invalid username") ||
      t.includes("invalid password") ||
      t.includes("does not match") ||
      t.includes("login failed")
    ) {
      throw new ConnectorError(
        "BAD_CREDENTIALS",
        `${this.label} rejected that username or password.`,
      );
    }
  }

  // ── Core login (shared) ────────────────────────────────────────────
  protected async performLogin(
    page: Page,
    creds: Credentials,
    log: SessionLogger,
    checks: Checks,
    mfaCode?: string,
  ): Promise<void> {
    try {
      await page.goto(this.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
    } catch (err) {
      throw new ConnectorError(
        "PROVIDER_TIMEOUT",
        `Couldn't reach ${this.label}. Try again shortly.`,
      );
    }
    checks.loginPageFound = true;
    log.record("login_page_loaded", true);

    const userSel = await this.firstExisting(page, this.usernameSelectors);
    const passSel = await this.firstExisting(page, this.passwordSelectors);
    checks.usernameFieldFound = !!userSel;
    checks.passwordFieldFound = !!passSel;
    if (!userSel || !passSel) {
      throw new ConnectorError(
        "LAYOUT_CHANGED",
        `${this.label}'s login page changed. We're on it — use manual upload meanwhile.`,
      );
    }
    await page.fill(userSel, creds.username);
    await page.fill(passSel, creds.password);

    const ssnSel = await this.firstExisting(page, this.ssnSelectors);
    checks.ssnFieldFound = !!ssnSel;
    if (ssnSel && creds.last4SSN) await page.fill(ssnSel, creds.last4SSN);
    log.record("credentials_entered", true, { hasSsnField: !!ssnSel });

    const submitSel = await this.firstExisting(page, this.submitSelectors);
    if (!submitSel) {
      throw new ConnectorError(
        "LAYOUT_CHANGED",
        `Couldn't find ${this.label}'s login button.`,
      );
    }
    await page.click(submitSel);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    log.record("login_submitted", true);

    // MFA code supplied this run → enter it, then re-check.
    if (mfaCode) {
      const codeSel = await this.firstExisting(page, this.mfaSelectors);
      if (codeSel) {
        await page.fill(codeSel, mfaCode);
        const codeSubmit = await this.firstExisting(page, this.submitSelectors);
        if (codeSubmit) await page.click(codeSubmit);
        await page
          .waitForLoadState("networkidle", { timeout: 30_000 })
          .catch(() => {});
        log.record("mfa_code_entered", true);
      }
    }

    await this.assertNoBlockingInterstitial(page, checks);
  }

  // ── Navigate to the 3-bureau report (override per provider if needed) ─
  protected async navigateToReport(
    page: Page,
    log: SessionLogger,
    checks: Checks,
  ): Promise<void> {
    for (const url of this.reportUrls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page
          .waitForLoadState("networkidle", { timeout: 20_000 })
          .catch(() => {});
        const t = await this.lowerText(page);
        if (
          t.includes("experian") ||
          t.includes("equifax") ||
          t.includes("transunion")
        ) {
          checks.reportPageReached = true;
          checks.downloadPageFound =
            t.includes("download") || t.includes("export") || t.includes("print");
          log.record("report_page_loaded", true, { url });
          return;
        }
      } catch {
        /* try next candidate */
      }
    }
    throw new ConnectorError(
      "REPORT_UNAVAILABLE",
      `Logged into ${this.label} but couldn't open the 3-bureau report.`,
    );
  }

  protected async captureReport(page: Page): Promise<FetchedReport> {
    // 3-bureau reports are JS-rendered and frequently lazy-load tradeline rows
    // as the user scrolls. Nudge the page to the bottom so the full list is in
    // the DOM before we serialize it — capturing too early yields a near-empty
    // shell, the #1 cause of "imported but zero tradelines". Best-effort: any
    // failure here just falls through to capturing whatever has rendered.
    try {
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, 1200);
        await page.waitForTimeout(200);
      }
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
    } catch {
      /* fall through and capture whatever rendered */
    }
    const html = await page.content();
    return { kind: "html", html };
  }

  private async launch(): Promise<{ browser: Browser; page: Page }> {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      viewport: { width: 1366, height: 900 },
    });
    context.setDefaultTimeout(30_000);
    const page = await context.newPage();
    return { browser, page };
  }

  // ── Public: real import (used by /v1/import) ───────────────────────
  async run(creds: Credentials, mfaCode?: string): Promise<ImportResult> {
    const log = new SessionLogger();
    const checks = emptyChecks();
    let browser: Browser | null = null;
    try {
      const launched = await this.launch();
      browser = launched.browser;
      log.record("browser_launched", true, { provider: this.id });
      await this.performLogin(launched.page, creds, log, checks, mfaCode);
      await this.navigateToReport(launched.page, log, checks);
      const fetched = await this.captureReport(launched.page);
      log.record("report_captured", true, {
        kind: fetched.kind,
        bytes: fetched.kind === "html" ? fetched.html.length : undefined,
      });
      return { ok: true, provider: this.id, fetched, checks, log: log.get() };
    } catch (err) {
      const ce =
        err instanceof ConnectorError
          ? err
          : new ConnectorError("UNKNOWN", "Unexpected connector error.");
      log.record("failed", false, { code: ce.code });
      return {
        ok: false,
        provider: this.id,
        checks,
        log: log.get(),
        error: { code: ce.code, message: ce.userMessage },
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // ── Public: diagnostic test with screenshots (used by /v1/test) ────
  async test(
    creds: Credentials,
    opts?: { mfaCode?: string },
  ): Promise<TestResult> {
    const sessionId = `${Date.now()}`;
    const log = new SessionLogger();
    const checks = emptyChecks();
    const shots: Screenshot[] = [];
    let browser: Browser | null = null;
    let error: TestResult["error"];

    try {
      const launched = await this.launch();
      browser = launched.browser;
      const page = launched.page;

      // before login
      await page
        .goto(this.loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })
        .catch(() => {});
      checks.loginPageFound = true;
      shots.push(await this.capture(page, sessionId, "before-login"));
      checks.usernameFieldFound = !!(await this.firstExisting(
        page,
        this.usernameSelectors,
      ));
      checks.passwordFieldFound = !!(await this.firstExisting(
        page,
        this.passwordSelectors,
      ));
      checks.ssnFieldFound = !!(await this.firstExisting(page, this.ssnSelectors));

      // attempt login
      try {
        await this.performLogin(page, creds, log, checks, opts?.mfaCode);
        shots.push(await this.capture(page, sessionId, "after-login"));
        await this.navigateToReport(page, log, checks);
        shots.push(await this.capture(page, sessionId, "report-page"));
      } catch (err) {
        const ce =
          err instanceof ConnectorError
            ? err
            : new ConnectorError("UNKNOWN", (err as Error).message);
        error = { code: ce.code, message: ce.userMessage };
        // capture whatever the error page looks like
        shots.push(await this.capture(page, sessionId, "error-page"));
      }
    } catch (err) {
      error = { code: "UNKNOWN", message: (err as Error).message };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    return {
      provider: this.id,
      status: deriveStatus(checks, error?.code),
      checks,
      screenshots: shots,
      log: log.get(),
      error,
      finishedAt: Date.now(),
    };
  }

  // ── Public: lightweight health probe (no creds) ────────────────────
  async probe(): Promise<{ status: ProviderStatus; checks: Checks }> {
    const checks = emptyChecks();
    let browser: Browser | null = null;
    try {
      const launched = await this.launch();
      browser = launched.browser;
      const page = launched.page;
      await page
        .goto(this.loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
        .catch(() => {});
      checks.loginPageFound = true;
      checks.usernameFieldFound = !!(await this.firstExisting(
        page,
        this.usernameSelectors,
      ));
      checks.passwordFieldFound = !!(await this.firstExisting(
        page,
        this.passwordSelectors,
      ));
    } catch {
      /* leave checks false → RED */
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
    const ok =
      checks.loginPageFound &&
      checks.usernameFieldFound &&
      checks.passwordFieldFound;
    return { status: ok ? "GREEN" : "RED", checks };
  }
}

// GREEN working / YELLOW MFA / RED selector broken (or unreachable).
export function deriveStatus(
  checks: Checks,
  errorCode?: string,
): ProviderStatus {
  if (
    errorCode === "LAYOUT_CHANGED" ||
    errorCode === "REPORT_UNAVAILABLE" ||
    errorCode === "PROVIDER_TIMEOUT" ||
    !checks.loginPageFound ||
    !checks.usernameFieldFound ||
    !checks.passwordFieldFound
  ) {
    return "RED";
  }
  if (checks.mfaChallenge || checks.captcha || errorCode === "MFA_REQUIRED" || errorCode === "CAPTCHA") {
    return "YELLOW";
  }
  if (checks.reportPageReached) return "GREEN";
  // Login form OK but report not verified (e.g., test/bad creds, lock).
  return "YELLOW";
}
