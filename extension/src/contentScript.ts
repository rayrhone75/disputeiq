// Content script — runs on https://member.myscoreiq.com/* (per
// manifest content_scripts.matches).
//
// Responsibilities:
//   1. Register a message listener so the background worker can ask us
//      to read the JSON body of the current page.
//   2. Detect whether the current page is the JSON report or a login
//      page, and report that to the background.
//
// We never read or POST anywhere ourselves — we just hand the body
// (or a "needs login" verdict) back to the background worker, which
// owns the auth + network pipeline.

import { looksLikeJson, payloadSummary } from "./security";

type DetectResult =
  | { kind: "json"; bodyText: string; bytes: number }
  | { kind: "login_required" }
  | { kind: "wrong_page" };

function detectPage(): DetectResult {
  const isJsonPath =
    location.pathname.toLowerCase().includes("creditreport.aspx") &&
    /[?&]view=json\b/i.test(location.search);
  if (!isJsonPath) {
    return { kind: "wrong_page" };
  }
  const body = (document.body?.innerText ?? "").trim();
  if (!body) {
    return { kind: "wrong_page" };
  }
  if (looksLikeJson(body)) {
    return { kind: "json", bodyText: body, bytes: body.length };
  }
  // The CreditReport.aspx URL exists but the body is HTML — most
  // commonly because MyScoreIQ redirected us to a login interstitial.
  return { kind: "login_required" };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "DISPUTEIQ_DETECT_PAGE") {
    const result = detectPage();
    if (result.kind === "json") {
      console.info(
        `[DisputeIQ] JSON page detected: ${payloadSummary(result.bodyText)}`,
      );
    } else {
      console.info(`[DisputeIQ] page state: ${result.kind}`);
    }
    sendResponse(result);
    return true; // keep the message channel alive for async response
  }
  return false;
});
