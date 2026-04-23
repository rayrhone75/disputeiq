// Provider adapter registry. Adding a new provider is:
//   1. Implement CreditProviderAdapter in ./my-provider.ts
//   2. Register it here.
// The import runner picks the right adapter based on either an explicit
// provider hint or by scanning adapters for `.matches(raw)`.

import type { CreditProvider } from "@prisma/client";
import type { CreditProviderAdapter } from "../types";
import { identityIqAdapter, myScoreIqAdapter } from "./identityiq";

const ADAPTERS: Record<CreditProvider, CreditProviderAdapter | null> = {
  IDENTITYIQ: identityIqAdapter,
  MYSCOREIQ: myScoreIqAdapter,
  MYFREESCORENOW: null, // future
  MANUAL: null,
};

export function getAdapter(provider: CreditProvider): CreditProviderAdapter {
  const a = ADAPTERS[provider];
  if (!a) throw new Error(`NO_ADAPTER_FOR_PROVIDER:${provider}`);
  return a;
}

/**
 * Auto-detect the best-matching adapter for an unknown payload.
 * Falls back to IdentityIQ (which is the most tolerant adapter) so that we
 * still produce a normalized preview for admin review even when the header
 * shape is unrecognized.
 */
export function detectAdapter(raw: unknown): CreditProviderAdapter {
  for (const adapter of Object.values(ADAPTERS)) {
    if (adapter && adapter.matches(raw)) return adapter;
  }
  return identityIqAdapter;
}

export { identityIqAdapter, myScoreIqAdapter };
