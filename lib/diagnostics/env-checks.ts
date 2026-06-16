// Launch env-var diagnostic — server only.
//
// Reports which required/optional environment variables are PRESENT, grouped
// by feature, so an admin can see at a glance what still needs configuring in
// Vercel before launch. NEVER returns a value — only booleans. Read-only.

function has(name: string): boolean {
  return Boolean(process.env[name] && process.env[name]!.trim().length > 0);
}
function hasMin(name: string, min: number): boolean {
  return (process.env[name] ?? "").trim().length >= min;
}

export type EnvCheck = { key: string; set: boolean; note?: string };
export type EnvGroup = {
  id: string;
  label: string;
  /** Blocks the core customer flow if not satisfied. */
  required: boolean;
  /** All required vars in this group are present. */
  ready: boolean;
  checks: EnvCheck[];
  note?: string;
};

export type EnvReport = {
  launchReady: boolean;
  groups: EnvGroup[];
  generatedNote: string;
};

export function buildEnvReport(): EnvReport {
  const groups: EnvGroup[] = [];

  // ── Core AI (hard blocker) ───────────────────────────────────────────
  const ai: EnvCheck[] = [
    { key: "OPENAI_API_KEY", set: has("OPENAI_API_KEY"), note: "paralegal + lawyer pipeline" },
    { key: "MISTRAL_API_KEY", set: has("MISTRAL_API_KEY"), note: "PDF OCR" },
  ];
  groups.push(groupOf("ai", "AI extraction (core)", true, ai));

  // ── Encryption keys ──────────────────────────────────────────────────
  const enc: EnvCheck[] = [
    { key: "ENCRYPTION_KEY", set: hasMin("ENCRYPTION_KEY", 32), note: "≥32 chars" },
    {
      key: "CREDIT_REPORT_ENCRYPTION_KEY",
      set: hasMin("CREDIT_REPORT_ENCRYPTION_KEY", 32),
      note: "optional — falls back to ENCRYPTION_KEY",
    },
    {
      key: "CREDIT_CONNECTOR_VAULT_KEY",
      set: hasMin("CREDIT_CONNECTOR_VAULT_KEY", 32),
      note: "required only for 'remember login'",
    },
  ];
  // Only ENCRYPTION_KEY is strictly required.
  groups.push({
    ...groupOf("encryption", "Encryption keys", true, enc),
    ready: hasMin("ENCRYPTION_KEY", 32),
  });

  // ── Auth (Clerk) ─────────────────────────────────────────────────────
  groups.push(
    groupOf("auth", "Auth (Clerk)", true, [
      { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", set: has("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") },
      { key: "CLERK_SECRET_KEY", set: has("CLERK_SECRET_KEY") },
    ]),
  );

  // ── Convex ───────────────────────────────────────────────────────────
  groups.push(
    groupOf("convex", "Database (Convex)", true, [
      { key: "NEXT_PUBLIC_CONVEX_URL", set: has("NEXT_PUBLIC_CONVEX_URL") },
      { key: "CONVEX_DEPLOYMENT", set: has("CONVEX_DEPLOYMENT") },
    ]),
  );

  // ── Payments: Square primary, Stripe fallback + subscriptions ────────
  const squareChecks: EnvCheck[] = [
    { key: "SQUARE_ACCESS_TOKEN", set: has("SQUARE_ACCESS_TOKEN") },
    { key: "SQUARE_LOCATION_ID", set: has("SQUARE_LOCATION_ID") },
    { key: "SQUARE_WEBHOOK_SIGNATURE_KEY", set: has("SQUARE_WEBHOOK_SIGNATURE_KEY") },
    { key: "SQUARE_ENVIRONMENT", set: has("SQUARE_ENVIRONMENT"), note: "production | sandbox" },
  ];
  const squareReady =
    has("SQUARE_ACCESS_TOKEN") &&
    has("SQUARE_LOCATION_ID") &&
    has("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const stripeChecks: EnvCheck[] = [
    { key: "STRIPE_SECRET_KEY", set: has("STRIPE_SECRET_KEY") },
    { key: "STRIPE_WEBHOOK_SECRET", set: has("STRIPE_WEBHOOK_SECRET") },
    { key: "STRIPE_PRICE_STARTER", set: has("STRIPE_PRICE_STARTER") },
    { key: "STRIPE_PRICE_PRO", set: has("STRIPE_PRICE_PRO") },
    { key: "STRIPE_PRICE_ELITE", set: has("STRIPE_PRICE_ELITE") },
  ];
  const stripeReady = has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET");

  // One-time payments need Square OR Stripe; subscriptions need Stripe.
  groups.push({
    id: "payments-square",
    label: "Payments — Square (primary one-time)",
    required: false,
    ready: squareReady,
    checks: squareChecks,
    note: "Primary for one-time packet charges. Either Square or Stripe must be configured.",
  });
  groups.push({
    id: "payments-stripe",
    label: "Payments — Stripe (subscriptions + fallback)",
    required: true,
    ready: stripeReady,
    checks: stripeChecks,
    note: "Required for recurring subscriptions; also the one-time fallback.",
  });

  // ── Letter drafting (Anthropic) ──────────────────────────────────────
  groups.push(
    groupOf("anthropic", "Letter drafting (Anthropic)", true, [
      { key: "ANTHROPIC_API_KEY", set: has("ANTHROPIC_API_KEY"), note: "else letters show [OFFLINE-AI]" },
    ]),
  );

  // ── Mailing (LetterStream) ───────────────────────────────────────────
  groups.push(
    groupOf("mail", "Mailing (LetterStream)", true, [
      { key: "LETTERSTREAM_API_ID", set: has("LETTERSTREAM_API_ID") },
      { key: "LETTERSTREAM_API_KEY", set: has("LETTERSTREAM_API_KEY") },
    ]),
  );

  // ── Storage (Cloudflare R2 / S3) ─────────────────────────────────────
  groups.push(
    groupOf("storage", "Storage (R2 / S3)", true, [
      { key: "STORAGE_BUCKET", set: has("STORAGE_BUCKET") },
      { key: "STORAGE_ACCESS_KEY", set: has("STORAGE_ACCESS_KEY") },
      { key: "STORAGE_SECRET_KEY", set: has("STORAGE_SECRET_KEY") },
      { key: "STORAGE_ENDPOINT", set: has("STORAGE_ENDPOINT") },
    ]),
  );

  // ── One-click connectors (optional for launch; required for auto-import)
  const connChecks: EnvCheck[] = [
    { key: "CONNECTOR_WORKER_URL", set: has("CONNECTOR_WORKER_URL") },
    { key: "CONNECTOR_WORKER_SECRET", set: has("CONNECTOR_WORKER_SECRET") },
    { key: "FEATURE_CREDIT_CONNECTORS", set: process.env.FEATURE_CREDIT_CONNECTORS === "true", note: "master flag" },
    { key: "FEATURE_MYSCOREIQ_CONNECTOR", set: process.env.FEATURE_MYSCOREIQ_CONNECTOR === "true" },
    { key: "FEATURE_MYFREESCORENOW_CONNECTOR", set: process.env.FEATURE_MYFREESCORENOW_CONNECTOR === "true" },
  ];
  groups.push({
    id: "connectors",
    label: "One-click connectors (auto-import)",
    required: false,
    ready: has("CONNECTOR_WORKER_URL") && has("CONNECTOR_WORKER_SECRET"),
    checks: connChecks,
    note: "Optional for launch; required for the connect-account auto-import path.",
  });

  // ── App base URL ─────────────────────────────────────────────────────
  groups.push(
    groupOf("app", "App base URL", true, [
      { key: "APP_BASE_URL", set: has("APP_BASE_URL"), note: "redirects + webhook URLs" },
    ]),
  );

  // One-time payments are satisfied by either provider — fold that into the
  // launch gate rather than failing because Square happens to be blank.
  const paymentsOk = squareReady || stripeReady;
  const launchReady =
    groups
      .filter((g) => g.required && g.id !== "payments-stripe")
      .every((g) => g.ready) && paymentsOk;

  return {
    launchReady,
    groups,
    generatedNote:
      "Presence only — values are never read. 'required' groups gate the core flow; one-time payments need Square OR Stripe.",
  };
}

function groupOf(
  id: string,
  label: string,
  required: boolean,
  checks: EnvCheck[],
): EnvGroup {
  return { id, label, required, ready: checks.every((c) => c.set), checks };
}
