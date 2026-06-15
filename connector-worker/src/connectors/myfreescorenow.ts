// MyFreeScoreNow connector.
//
// MyFreeScoreNow (members.myfreescorenow.com) typically logs in with
// email + password and may not require SSN. Selectors are best-effort and
// verified via /v1/test + the admin dashboard.

import { BaseConnector } from "./base.js";
import type { ProviderId } from "../types.js";

export class MyFreeScoreNowConnector extends BaseConnector {
  readonly id: ProviderId = "MYFREESCORENOW";
  readonly label = "MyFreeScoreNow";
  readonly loginUrl = "https://members.myfreescorenow.com/login";
  readonly requiresSsn = false;

  readonly usernameSelectors = [
    "#email",
    "input[name='email']",
    "input[name='username']",
    "input[type='email']",
    "input[autocomplete='username']",
  ];
  readonly passwordSelectors = [
    "#password",
    "input[name='password']",
    "input[type='password']",
  ];
  readonly ssnSelectors = [
    "input[name='ssnLast4']",
    "input[name='last4']",
    "input[name='ssn']",
  ];
  readonly submitSelectors = [
    "button[type='submit']",
    "input[type='submit']",
    "#loginButton",
    "button:has-text('Log In')",
    "button:has-text('Login')",
    "button:has-text('Sign In')",
  ];
  readonly mfaSelectors = [
    "input[name='code']",
    "input[name='otp']",
    "input[name='verificationCode']",
    "input[autocomplete='one-time-code']",
  ];
  readonly reportUrls = [
    "https://members.myfreescorenow.com/credit-report",
    "https://members.myfreescorenow.com/dashboard/credit-report",
    "https://members.myfreescorenow.com/3b-report",
  ];
}
