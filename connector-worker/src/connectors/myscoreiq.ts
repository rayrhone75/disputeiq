// MyScoreIQ connector.
//
// Selectors are best-effort against the live MyScoreIQ markup and are the
// thing most likely to need tuning over time. The /v1/test endpoint +
// admin dashboard exist precisely to verify these against production and
// flag RED the moment they drift.

import { BaseConnector } from "./base.js";
import type { ProviderId } from "../types.js";

export class MyScoreIQConnector extends BaseConnector {
  readonly id: ProviderId = "MYSCOREIQ";
  readonly label = "MyScoreIQ";
  readonly loginUrl = "https://www.myscoreiq.com/login.aspx";
  readonly requiresSsn = true;

  readonly usernameSelectors = [
    "#username",
    "input[name='username']",
    "input[name='Username']",
    "input[name='UserName']",
    "input[type='email']",
    "input[autocomplete='username']",
  ];
  readonly passwordSelectors = [
    "#password",
    "input[name='password']",
    "input[name='Password']",
    "input[type='password']",
  ];
  readonly ssnSelectors = [
    "#ssn",
    "input[name='ssnLast4']",
    "input[name='last4']",
    "input[name='SSNLast4']",
    "input[name='ssn']",
  ];
  readonly submitSelectors = [
    "button[type='submit']",
    "input[type='submit']",
    "#loginButton",
    "#btnLogin",
    "button:has-text('Log In')",
    "button:has-text('Sign In')",
  ];
  readonly mfaSelectors = [
    "input[name='code']",
    "input[name='otp']",
    "input[name='verificationCode']",
    "input[autocomplete='one-time-code']",
  ];
  readonly reportUrls = [
    "https://www.myscoreiq.com/credit-report.aspx",
    "https://www.myscoreiq.com/Members/CreditReport.aspx",
    "https://www.myscoreiq.com/Members/3BureauCreditReport.aspx",
  ];
}
