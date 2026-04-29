// Service worker — the brain of the extension.
//
// Manifest V3 service workers are terminated when idle and restarted
// on demand, so we keep no in-memory state. Everything persistent
// lives in chrome.storage (see ./storage.ts). Our job is to mediate
// between the popup, the content script on member.myscoreiq.com, and
// the DisputeIQ API.
//
// Message protocol (popup → background):
//   { type: "PAIR_COMPLETE", pairToken }
//     → returns { ok, error? } and persists the long-lived token.
//   { type: "GET_STATE" }
//     → returns { paired, pairing, lastImport, status }.
//   { type: "IMPORT_NOW" }
//     → finds (or opens) the MyScoreIQ JSON tab, asks the content script
//       for the body, POSTs it to DisputeIQ, returns the import result.
//   { type: "DISCONNECT" }
//     → clears chrome.storage of the pairing.

import { dashboardUrlFor, getStatus, importMyScoreIqJson, pairComplete } from "./api";
import {
  clearPairing,
  getLastImport,
  getPairing,
  setLastImport,
  setPairing,
  type StoredPairing,
} from "./storage";

const JSON_URL = "https://member.myscoreiq.com/CreditReport.aspx?view=json";
const LOGIN_URL = "https://member.myscoreiq.com/Login.aspx";

type Msg =
  | { type: "PAIR_COMPLETE"; pairToken: string }
  | { type: "GET_STATE" }
  | { type: "IMPORT_NOW" }
  | { type: "DISCONNECT" };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  void handleMessage(msg).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: (err as Error).message });
  });
  return true; // async response
});

async function handleMessage(msg: Msg): Promise<unknown> {
  switch (msg.type) {
    case "PAIR_COMPLETE":
      return pairCompleteFlow(msg.pairToken);
    case "GET_STATE":
      return getState();
    case "IMPORT_NOW":
      return importNow();
    case "DISCONNECT":
      await clearPairing();
      await setLastImport(null);
      return { ok: true };
    default:
      return { ok: false, error: "UNKNOWN_MESSAGE" };
  }
}

async function pairCompleteFlow(pairToken: string) {
  const r = await pairComplete(pairToken.trim());
  if (!r.ok) return { ok: false, error: `${r.code}: ${r.message}` };
  const stored: StoredPairing = {
    extensionToken: r.extensionToken,
    expiresAt: r.expiresAt,
    pairingId: r.pairingId,
    user: r.user,
    pairedAt: Date.now(),
  };
  await setPairing(stored);
  return { ok: true, user: r.user };
}

async function getState() {
  const pairing = await getPairing();
  const lastImport = await getLastImport();
  if (!pairing) {
    return { paired: false, pairing: null, lastImport, status: null };
  }
  // Touch /status so admins see the extension as alive AND we detect
  // server-side revocation.
  const status = await getStatus(pairing.extensionToken);
  if (!status.ok && status.code === "PAIRING_REVOKED_OR_MISSING") {
    await clearPairing();
    return {
      paired: false,
      pairing: null,
      lastImport,
      status: {
        ok: false,
        code: "PAIRING_REVOKED_OR_MISSING",
        message:
          "Your DisputeIQ pairing was revoked. Re-pair from the dashboard.",
      },
    };
  }
  return { paired: true, pairing, lastImport, status };
}

/**
 * Import flow:
 *   1. Find an existing MyScoreIQ JSON tab and ask the content script
 *      to read it. If found and JSON, POST to DisputeIQ.
 *   2. If found but the page is the login interstitial, open the login
 *      tab, return needs_login.
 *   3. If no tab exists, open the JSON URL in a new tab — the user's
 *      browser session decides whether they see the JSON or the login
 *      page; the content script will message back as soon as the
 *      page loads.
 */
async function importNow(): Promise<unknown> {
  const pairing = await getPairing();
  if (!pairing) {
    return { ok: false, error: "NOT_PAIRED" };
  }

  await setLastImport({ kind: "in_flight", startedAt: Date.now() });

  const detect = await detectInOpenTab();
  if (detect.outcome === "no_tab") {
    // Open the JSON URL; the user's browser will either render the
    // JSON (logged in) or redirect to the login page. We can't
    // predict which without trying, so we surface a "tab opened —
    // please log in if prompted, then click Import again".
    await chrome.tabs.create({ url: JSON_URL, active: true });
    await setLastImport({
      kind: "failure",
      code: "TAB_OPENED",
      message:
        "Opened the MyScoreIQ JSON page. If MyScoreIQ asked you to sign in, finish that and click Import again.",
      at: Date.now(),
    });
    return { ok: false, error: "TAB_OPENED" };
  }

  if (detect.outcome === "login_required") {
    // The MyScoreIQ tab is on a login page. Bring it forward + tell
    // the popup so it can show "log in, then retry".
    if (detect.tabId) {
      await chrome.tabs.update(detect.tabId, { active: true });
    } else {
      await chrome.tabs.create({ url: LOGIN_URL, active: true });
    }
    await setLastImport({
      kind: "failure",
      code: "LOGIN_REQUIRED",
      message:
        "MyScoreIQ wants you to sign in. Once you see your JSON report, click Import again.",
      at: Date.now(),
    });
    return { ok: false, error: "LOGIN_REQUIRED" };
  }

  if (detect.outcome === "wrong_page") {
    // User has a MyScoreIQ tab open but it's not the JSON page.
    // Navigate that tab to the JSON URL and ask them to retry.
    await chrome.tabs.update(detect.tabId, { url: JSON_URL, active: true });
    await setLastImport({
      kind: "failure",
      code: "WRONG_PAGE",
      message:
        "Sent your MyScoreIQ tab to the JSON report page. Click Import again once it loads.",
      at: Date.now(),
    });
    return { ok: false, error: "WRONG_PAGE" };
  }

  // We have JSON. POST to DisputeIQ.
  const result = await importMyScoreIqJson(
    pairing.extensionToken,
    detect.bodyText,
  );
  if (result.ok) {
    await setLastImport({
      kind: "success",
      importId: result.importId,
      tradelineCount: result.tradelineCount,
      at: Date.now(),
    });
    notify(
      "DisputeIQ: report imported",
      `${result.tradelineCount} tradelines, ${result.candidatesCreated} dispute candidates.`,
    );
    return {
      ok: true,
      importId: result.importId,
      tradelineCount: result.tradelineCount,
      dashboardUrl: dashboardUrlFor(result.redirect),
    };
  }
  if (result.code === "PAIRING_REVOKED_OR_MISSING") {
    await clearPairing();
  }
  await setLastImport({
    kind: "failure",
    code: result.code,
    message: result.message,
    at: Date.now(),
  });
  return { ok: false, error: `${result.code}: ${result.message}` };
}

type DetectInOpenTab =
  | { outcome: "json"; bodyText: string; tabId: number }
  | { outcome: "login_required"; tabId: number | null }
  | { outcome: "wrong_page"; tabId: number }
  | { outcome: "no_tab" };

async function detectInOpenTab(): Promise<DetectInOpenTab> {
  // Find any tab on member.myscoreiq.com — the content script is
  // already injected via manifest content_scripts.
  const tabs = await chrome.tabs.query({
    url: "https://member.myscoreiq.com/*",
  });
  if (tabs.length === 0) return { outcome: "no_tab" };
  // Prefer a JSON-page tab; fall back to any MyScoreIQ tab.
  const jsonTab =
    tabs.find((t) =>
      t.url
        ? /CreditReport\.aspx\?[^#]*\bview=json\b/i.test(t.url)
        : false,
    ) ?? tabs[0];
  const tabId = jsonTab.id;
  if (typeof tabId !== "number") return { outcome: "no_tab" };

  try {
    const detect = (await chrome.tabs.sendMessage(tabId, {
      type: "DISPUTEIQ_DETECT_PAGE",
    })) as
      | { kind: "json"; bodyText: string; bytes: number }
      | { kind: "login_required" }
      | { kind: "wrong_page" };
    if (detect.kind === "json") {
      return { outcome: "json", bodyText: detect.bodyText, tabId };
    }
    if (detect.kind === "login_required") {
      return { outcome: "login_required", tabId };
    }
    return { outcome: "wrong_page", tabId };
  } catch {
    // Content script not yet injected (page still loading) or tab
    // navigated. Treat as wrong_page so the popup can offer to open
    // the JSON URL.
    return { outcome: "wrong_page", tabId };
  }
}

function notify(title: string, message: string) {
  // Best-effort — Chrome extension notifications require the
  // "notifications" permission which we don't ask for in Phase 1.
  // For now, log to the service-worker console which is visible
  // in chrome://extensions → Service Worker → Inspect.
  console.info(`[DisputeIQ] ${title} — ${message}`);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: `${dashboardUrlFor("/dashboard/get-report")}?installed=1`,
    });
  }
});
