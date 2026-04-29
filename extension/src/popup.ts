// Popup script. Reads state from the background worker, drives the
// pair / import / disconnect UI. Manifest V3 service worker may be
// asleep when the popup opens; chrome.runtime.sendMessage wakes it up.

import { dashboardUrlFor } from "./api";

type State = {
  paired: boolean;
  pairing: {
    user: { email: string };
    pairedAt: number;
    expiresAt: number;
  } | null;
  lastImport:
    | { kind: "success"; importId: string; tradelineCount: number; at: number }
    | { kind: "failure"; code: string; message: string; at: number }
    | { kind: "in_flight"; startedAt: number }
    | null;
  status: { ok: boolean; code?: string; message?: string } | null;
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const viewUnpaired = $("view-unpaired");
const viewPaired = $("view-paired");
const pairInput = $<HTMLTextAreaElement>("pair-input");
const pairBtn = $<HTMLButtonElement>("pair-btn");
const pairError = $("pair-error");
const importBtn = $<HTMLButtonElement>("import-btn");
const importResult = $("import-result");
const openDashboard = $<HTMLButtonElement>("open-dashboard");
const openDashboardLink = $<HTMLAnchorElement>("open-dashboard-link");
const openMsiq = $<HTMLButtonElement>("open-msiq");
const disconnectBtn = $<HTMLButtonElement>("disconnect-btn");
const verEl = $("ver");
const pairedEmail = $("paired-email");
const pairedStatus = $("paired-status");
const pairedLast = $("paired-last");

verEl.textContent = chrome.runtime.getManifest().version;
openDashboardLink.href = dashboardUrlFor("/dashboard/get-report");

async function send<R>(msg: unknown): Promise<R> {
  return (await chrome.runtime.sendMessage(msg)) as R;
}

async function refresh() {
  const state = (await send({ type: "GET_STATE" })) as State;
  render(state);
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

function render(state: State) {
  if (!state.paired) {
    viewUnpaired.classList.remove("hidden");
    viewPaired.classList.add("hidden");
    if (state.status && !state.status.ok) {
      pairError.textContent =
        state.status.message ?? "Pairing was revoked. Re-pair.";
      pairError.classList.remove("hidden");
    }
    return;
  }
  viewUnpaired.classList.add("hidden");
  viewPaired.classList.remove("hidden");
  pairedEmail.textContent = state.pairing?.user.email ?? "—";

  if (state.status?.ok) {
    pairedStatus.textContent = "Connected";
    pairedStatus.className = "badge-status ok";
  } else if (state.status) {
    pairedStatus.textContent = "Disconnected";
    pairedStatus.className = "badge-status err";
  }

  if (state.lastImport?.kind === "success") {
    pairedLast.textContent = fmtTime(state.lastImport.at);
    importResult.className = "alert alert-success";
    importResult.innerHTML = `Last import: <strong>${state.lastImport.tradelineCount}</strong> tradelines.`;
    importResult.classList.remove("hidden");
  } else if (state.lastImport?.kind === "failure") {
    pairedLast.textContent = fmtTime(state.lastImport.at);
    importResult.className = "alert alert-error";
    importResult.textContent = state.lastImport.message;
    importResult.classList.remove("hidden");
  } else if (state.lastImport?.kind === "in_flight") {
    importResult.className = "alert alert-warn";
    importResult.textContent = "Importing…";
    importResult.classList.remove("hidden");
  } else {
    pairedLast.textContent = "never";
    importResult.classList.add("hidden");
  }
}

pairBtn.addEventListener("click", async () => {
  const token = pairInput.value.trim();
  if (!token) {
    pairError.textContent = "Paste the pairing token from DisputeIQ first.";
    pairError.classList.remove("hidden");
    return;
  }
  pairError.classList.add("hidden");
  pairBtn.disabled = true;
  pairBtn.textContent = "Pairing…";
  try {
    const r = (await send({ type: "PAIR_COMPLETE", pairToken: token })) as {
      ok: boolean;
      error?: string;
    };
    if (!r.ok) {
      pairError.textContent = r.error ?? "Pair failed.";
      pairError.classList.remove("hidden");
      return;
    }
    pairInput.value = "";
    await refresh();
  } finally {
    pairBtn.disabled = false;
    pairBtn.textContent = "Pair Extension";
  }
});

openDashboard.addEventListener("click", () => {
  chrome.tabs.create({
    url: dashboardUrlFor("/dashboard/get-report?pairing=1"),
  });
});

openMsiq.addEventListener("click", () => {
  chrome.tabs.create({
    url: "https://member.myscoreiq.com/CreditReport.aspx?view=json",
  });
});

importBtn.addEventListener("click", async () => {
  importBtn.disabled = true;
  importBtn.textContent = "Importing…";
  importResult.className = "alert alert-warn";
  importResult.textContent = "Reading your MyScoreIQ tab…";
  importResult.classList.remove("hidden");
  try {
    const r = (await send({ type: "IMPORT_NOW" })) as {
      ok: boolean;
      error?: string;
      importId?: string;
      tradelineCount?: number;
      dashboardUrl?: string;
    };
    if (r.ok) {
      importResult.className = "alert alert-success";
      importResult.innerHTML = `Imported <strong>${r.tradelineCount}</strong> tradelines. <a href="${r.dashboardUrl}" target="_blank" rel="noreferrer">Open dashboard ↗</a>`;
    } else if (r.error === "TAB_OPENED") {
      importResult.className = "alert alert-warn";
      importResult.textContent =
        "Opened MyScoreIQ in a new tab. Sign in if asked, then click Import again.";
    } else if (r.error === "LOGIN_REQUIRED") {
      importResult.className = "alert alert-warn";
      importResult.textContent =
        "MyScoreIQ wants you to sign in. Once you see your JSON report, click Import again.";
    } else if (r.error === "NOT_PAIRED") {
      importResult.className = "alert alert-error";
      importResult.textContent = "Extension is not paired.";
      await refresh();
    } else {
      importResult.className = "alert alert-error";
      importResult.textContent = r.error ?? "Import failed.";
    }
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = "Import MyScoreIQ Report";
    void refresh();
  }
});

disconnectBtn.addEventListener("click", async () => {
  await send({ type: "DISCONNECT" });
  await refresh();
});

void refresh();
