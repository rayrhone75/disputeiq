// Credit Monitoring Connectors — provider registry + feature flags.
//
// A connector logs into a consumer credit-monitoring provider (with the
// customer's explicit consent) via the connector-worker service and pulls
// their latest 3-bureau report into the existing processCreditReport →
// runNormalization pipeline. Playwright runs ONLY in connector-worker/,
// never on Vercel.
//
// Flags (all default OFF):
//   FEATURE_CREDIT_CONNECTORS        master switch
//   FEATURE_MYSCOREIQ_CONNECTOR      per-provider
//   FEATURE_MYFREESCORENOW_CONNECTOR per-provider

export type ConnectorProviderId = "MYSCOREIQ" | "MYFREESCORENOW";

export type ConnectorFieldId = "username" | "password" | "last4SSN";

export type ConnectorProviderDef = {
  id: ConnectorProviderId;
  label: string;
  slug: string; // URL segment: /credit-import/connect/<slug>
  usernameLabel: string;
  fields: ConnectorFieldId[];
  flagEnv: string;
};

export const CONNECTOR_PROVIDERS: Record<
  ConnectorProviderId,
  ConnectorProviderDef
> = {
  MYSCOREIQ: {
    id: "MYSCOREIQ",
    label: "MyScoreIQ",
    slug: "myscoreiq",
    usernameLabel: "Username",
    fields: ["username", "password", "last4SSN"],
    flagEnv: "FEATURE_MYSCOREIQ_CONNECTOR",
  },
  MYFREESCORENOW: {
    id: "MYFREESCORENOW",
    label: "MyFreeScoreNow",
    slug: "myfreescorenow",
    usernameLabel: "Email or username",
    fields: ["username", "password", "last4SSN"],
    flagEnv: "FEATURE_MYFREESCORENOW_CONNECTOR",
  },
};

export const CONNECTOR_PROVIDER_LIST = Object.values(CONNECTOR_PROVIDERS);

export function isConnectorProvider(x: string): x is ConnectorProviderId {
  return x in CONNECTOR_PROVIDERS;
}

export function getConnectorProvider(id: string): ConnectorProviderDef | null {
  return isConnectorProvider(id) ? CONNECTOR_PROVIDERS[id] : null;
}

export function providerBySlug(slug: string): ConnectorProviderDef | null {
  return (
    CONNECTOR_PROVIDER_LIST.find((p) => p.slug === slug.toLowerCase()) ?? null
  );
}

/** Master switch — every connector route checks this first. */
export function connectorsEnabled(): boolean {
  return (process.env.FEATURE_CREDIT_CONNECTORS ?? "").toLowerCase() === "true";
}

/** Master switch AND the provider's own flag must both be "true". */
export function providerEnabled(id: ConnectorProviderId): boolean {
  if (!connectorsEnabled()) return false;
  const def = CONNECTOR_PROVIDERS[id];
  return (process.env[def.flagEnv] ?? "").toLowerCase() === "true";
}

/**
 * Format a 4-digit SSN tail as the standard masked display:
 *   "1234" → "***-**-1234". Returns "***-**-****" if no last4.
 */
export function maskSsn(last4?: string | null): string {
  if (!last4 || !/^\d{4}$/.test(last4)) return "***-**-****";
  return `***-**-${last4}`;
}
