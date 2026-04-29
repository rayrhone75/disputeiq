// Thin typed wrapper over chrome.storage.local for the DisputeIQ
// extension. Manifest V3 service workers can be terminated at any
// time, so all persistent state lives here. We never store the
// MyScoreIQ session cookie or password — only the DisputeIQ extension
// token (which is itself a signed bearer token, not a credential).

export type StoredPairing = {
  extensionToken: string;
  expiresAt: number;
  pairingId: string;
  user: { email: string };
  pairedAt: number;
};

const KEY = "disputeiq.pairing.v1";

export async function getPairing(): Promise<StoredPairing | null> {
  const v = await chrome.storage.local.get(KEY);
  const obj = v[KEY] as StoredPairing | undefined;
  if (!obj) return null;
  if (typeof obj.extensionToken !== "string") return null;
  if (Date.now() > obj.expiresAt) {
    await clearPairing();
    return null;
  }
  return obj;
}

export async function setPairing(pairing: StoredPairing): Promise<void> {
  await chrome.storage.local.set({ [KEY]: pairing });
}

export async function clearPairing(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

// Last-import status the popup uses to render success/failure UI.
export type LastImport =
  | { kind: "success"; importId: string; tradelineCount: number; at: number }
  | { kind: "failure"; code: string; message: string; at: number }
  | { kind: "in_flight"; startedAt: number };

const LAST_KEY = "disputeiq.lastImport.v1";

export async function getLastImport(): Promise<LastImport | null> {
  const v = await chrome.storage.local.get(LAST_KEY);
  return (v[LAST_KEY] as LastImport | undefined) ?? null;
}

export async function setLastImport(s: LastImport | null): Promise<void> {
  if (s === null) {
    await chrome.storage.local.remove(LAST_KEY);
    return;
  }
  await chrome.storage.local.set({ [LAST_KEY]: s });
}
