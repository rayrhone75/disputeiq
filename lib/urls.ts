// Centralized URL helpers. Never hardcode hosts anywhere else.
// Reads from env so the same build serves dev, staging, and production.

export const BRAND = {
  name: "DisputeIQ",
  domain: "disputeiq.org",
  appTitle: "DisputeIQ Portal",
  adminTitle: "DisputeIQ Command Center",
  supportEmail: "support@disputeiq.org",
} as const;

function clean(u: string | undefined, fallback: string) {
  if (!u) return fallback;
  return u.replace(/\/+$/, "");
}

export const URLS = {
  marketing: clean(process.env.NEXT_PUBLIC_MARKETING_URL ?? process.env.MARKETING_BASE_URL, "https://disputeiq.org"),
  app: clean(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_BASE_URL, "https://app.disputeiq.org"),
  admin: clean(process.env.ADMIN_BASE_URL, "https://app.disputeiq.org/admin"),
  api: clean(process.env.API_BASE_URL, "https://app.disputeiq.org/api"),
};

export const WEBHOOK_URLS = {
  square: `${URLS.app}/api/webhooks/square`,
  letterstream: `${URLS.app}/api/webhooks/letterstream`,
};

export const AUTH_CALLBACK = `${URLS.app}/api/auth/callback`;
