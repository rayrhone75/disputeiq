// Phase-4 automation rules.
//
// Pure function — given a snapshot of one customer's state, returns the
// list of rules currently firing. The Convex sweep walks all users,
// feeds this function, and persists firings as `automationEvents` rows.
//
// Idempotency lives in the sweep, not here. Rules are deterministic and
// fire as long as the underlying condition is true. The one exception
// is `first_deletion`, which fires only on the *first* observation —
// the sweep passes `firstDeletionAlreadyFired` based on whether ANY
// (open/reviewed/resolved) event of that key exists for the customer.

export type AutomationRuleKey =
  | "no_report_24h"
  | "no_disputes_24h"
  | "import_failed"
  | "inactive_3d"
  | "payment_failed"
  | "first_deletion"
  | "vip_followup";

export type AutomationSeverity = "info" | "warn" | "alert";

export type AutomationFiring = {
  ruleKey: AutomationRuleKey;
  severity: AutomationSeverity;
  label: string;
  payload?: Record<string, unknown>;
};

export type AutomationInput = {
  user: {
    _id: string;
    createdAt: number;
    isVip?: boolean | null;
    archivedAt?: number | null;
  };
  hasActiveSubscription: boolean;
  subscriptionStatus: string | null;
  importsCount: number;
  latestImportStatus: string | null;
  /** Unix ms when the latest import reached NORMALIZED, if it ever has. */
  latestImportNormalizedAt: number | null;
  disputesStarted: number;
  deletionsCount: number;
  pendingFollowUpsCount: number;
  /** ms timestamp of most recent activity, or null if none. */
  lastActivityAt: number | null;
  /** True if a `first_deletion` event already exists in any state. */
  firstDeletionAlreadyFired: boolean;
  /** Anchor "now" for deterministic tests. */
  nowMs: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Run all rules. Returns one entry per firing. Order matters for
 * display only — the sweep upserts independently.
 */
export function runAutomationRules(
  input: AutomationInput,
): AutomationFiring[] {
  const out: AutomationFiring[] = [];

  // Skip everything for archived users.
  if (input.user.archivedAt) return out;

  const ageMs = input.nowMs - input.user.createdAt;

  // Rule 1 — No report imported within 24h of signup.
  if (input.importsCount === 0 && ageMs >= 24 * HOUR) {
    out.push({
      ruleKey: "no_report_24h",
      severity: "warn",
      label: "Signed up but no report imported in 24h",
      payload: { hoursSinceSignup: Math.round(ageMs / HOUR) },
    });
  }

  // Rule 2 — Report imported but no dispute round started after 24h.
  if (
    input.latestImportStatus === "NORMALIZED" &&
    input.latestImportNormalizedAt !== null &&
    input.nowMs - input.latestImportNormalizedAt >= 24 * HOUR &&
    input.disputesStarted === 0
  ) {
    out.push({
      ruleKey: "no_disputes_24h",
      severity: "warn",
      label: "Report imported but no disputes started in 24h",
      payload: {
        hoursSinceImport: Math.round(
          (input.nowMs - input.latestImportNormalizedAt) / HOUR,
        ),
      },
    });
  }

  // Rule 3 — Most recent import is in FAILED status.
  if (input.latestImportStatus === "FAILED") {
    out.push({
      ruleKey: "import_failed",
      severity: "alert",
      label: "Most recent import failed",
    });
  }

  // Rule 4 — No customer activity in 3+ days.
  if (
    input.lastActivityAt !== null &&
    input.nowMs - input.lastActivityAt >= 3 * DAY
  ) {
    out.push({
      ruleKey: "inactive_3d",
      severity: "info",
      label: "No customer activity in 3+ days",
      payload: {
        daysInactive: Math.round((input.nowMs - input.lastActivityAt) / DAY),
      },
    });
  }

  // Rule 5 — Payment past_due.
  if (input.subscriptionStatus === "past_due") {
    out.push({
      ruleKey: "payment_failed",
      severity: "alert",
      label: "Subscription payment past due",
    });
  }

  // Rule 6 — First deletion landed (fire-once).
  if (input.deletionsCount > 0 && !input.firstDeletionAlreadyFired) {
    out.push({
      ruleKey: "first_deletion",
      severity: "info",
      label: "Customer achieved first deletion",
      payload: { deletions: input.deletionsCount },
    });
  }

  // Rule 7 — VIP customer with active dispute work but no scheduled follow-up.
  if (
    input.user.isVip &&
    input.disputesStarted > 0 &&
    input.pendingFollowUpsCount === 0
  ) {
    out.push({
      ruleKey: "vip_followup",
      severity: "info",
      label: "VIP customer has no scheduled follow-up",
    });
  }

  return out;
}

/**
 * Sort key for the admin feed — higher = more urgent.
 * alert > warn > info, then by recency (handled by the consumer).
 */
export function severityRank(s: AutomationSeverity): number {
  return s === "alert" ? 3 : s === "warn" ? 2 : 1;
}
