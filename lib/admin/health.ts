// Customer health signals — pure derivation.
//
// Same module is consumed by:
//   - Customer 360 (single-customer panel) — given the data the page
//     already loads (`/api/admin/customers/[id]`), produce the active
//     signals so admins can see at a glance what's going wrong.
//   - Admin home attention feed — walked across all users by the
//     server, returning the top signal per customer for triage.
//
// No background jobs. No new schema. Every input is something we
// already store.

export type HealthSignalKey =
  | "profile_missing"
  | "no_subscription"
  | "no_report"
  | "import_failed"
  | "no_disputes_started"
  | "inactive_30d"
  | "unread_admin_message"
  | "vip"
  | "past_due";

export type HealthSeverity = "info" | "warn" | "alert";

export type HealthSignal = {
  key: HealthSignalKey;
  severity: HealthSeverity;
  label: string;
  reason: string;
  ctaHref?: string;
};

export type HealthInput = {
  user: {
    _id?: string;
    email?: string;
    createdAt: number;
    isVip?: boolean | null;
    archivedAt?: number | null;
  };
  hasProfile: boolean;
  hasActiveSubscription: boolean;
  subscriptionStatus: string | null;
  importsCount: number;
  latestImportStatus: string | null;
  /** count of disputeCases (any status) */
  disputesStarted: number;
  /** ms timestamp of most recent activity (audit, login, etc.); null if unknown */
  lastActivityAt: number | null;
  /** count of admin-side unread threads created > 24h ago */
  staleAdminUnreadThreads: number;
  /**
   * Anchor "now" — pass `Date.now()` in callers. Exposed as a parameter
   * so unit tests are deterministic.
   */
  nowMs: number;
};

const DAY = 1000 * 60 * 60 * 24;

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  alert: 3,
  warn: 2,
  info: 1,
};

/**
 * Higher-priority signal sorts first. VIP and past-due float to the top
 * for the admin attention feed; the customer-360 panel renders the full
 * list so the order is informative but doesn't hide anything.
 */
function rankSignal(s: HealthSignal): number {
  const sev = SEVERITY_RANK[s.severity];
  // Bias certain keys upward.
  if (s.key === "past_due") return sev * 10 + 5;
  if (s.key === "unread_admin_message") return sev * 10 + 4;
  if (s.key === "import_failed") return sev * 10 + 3;
  if (s.key === "no_report") return sev * 10 + 2;
  return sev * 10;
}

export function deriveHealthSignals(input: HealthInput): HealthSignal[] {
  const out: HealthSignal[] = [];
  const ageDays = (input.nowMs - input.user.createdAt) / DAY;
  const archived = !!input.user.archivedAt;

  // Past-due is an alert regardless of anything else.
  if (input.subscriptionStatus === "past_due") {
    out.push({
      key: "past_due",
      severity: "alert",
      label: "Payment past due",
      reason: "Stripe reports a failed renewal — disputes are paused.",
      ctaHref: "/admin/customers", // admin context; customer-360 already shows banner
    });
  }

  if (input.staleAdminUnreadThreads > 0) {
    out.push({
      key: "unread_admin_message",
      severity: "alert",
      label: `${input.staleAdminUnreadThreads} unread message${
        input.staleAdminUnreadThreads === 1 ? "" : "s"
      }`,
      reason: "Customer wrote in over 24h ago and hasn't been answered.",
    });
  }

  if (!archived && !input.hasProfile && ageDays > 1) {
    out.push({
      key: "profile_missing",
      severity: "warn",
      label: "Profile incomplete",
      reason: `Joined ${Math.floor(ageDays)}d ago, no mailing address on file.`,
    });
  }

  if (
    !archived &&
    !input.hasActiveSubscription &&
    input.subscriptionStatus !== "past_due" &&
    ageDays > 1
  ) {
    out.push({
      key: "no_subscription",
      severity: "warn",
      label: "No active plan",
      reason: `Joined ${Math.floor(ageDays)}d ago without choosing a plan.`,
    });
  }

  if (!archived && input.importsCount === 0 && ageDays > 3) {
    out.push({
      key: "no_report",
      severity: "warn",
      label: "No report imported",
      reason: `Joined ${Math.floor(ageDays)}d ago — onboarding stalled at Connect Report.`,
    });
  }

  if (input.latestImportStatus === "FAILED") {
    out.push({
      key: "import_failed",
      severity: "alert",
      label: "Last import failed",
      reason: "Most recent credit-report import ended in FAILED status.",
    });
  }

  if (
    input.latestImportStatus === "NORMALIZED" &&
    input.disputesStarted === 0 &&
    ageDays > 7
  ) {
    out.push({
      key: "no_disputes_started",
      severity: "info",
      label: "Report imported, no disputes yet",
      reason: "File analyzed > 7 days ago but no rounds have been queued.",
    });
  }

  if (
    !archived &&
    input.lastActivityAt !== null &&
    (input.nowMs - input.lastActivityAt) / DAY >= 30
  ) {
    out.push({
      key: "inactive_30d",
      severity: "info",
      label: "Inactive 30+ days",
      reason: "No customer activity recorded for at least a month.",
    });
  }

  // VIP marker — informational, but bubbles to the top of the list.
  if (input.user.isVip) {
    out.unshift({
      key: "vip",
      severity: "info",
      label: "VIP",
      reason: "Marked VIP by an admin.",
    });
  }

  out.sort((a, b) => rankSignal(b) - rankSignal(a));
  return out;
}

/** Top signal for the admin attention feed (or null when healthy). */
export function topSignal(input: HealthInput): HealthSignal | null {
  const signals = deriveHealthSignals(input);
  // VIP alone shouldn't put a customer on the attention feed.
  const filtered = signals.filter((s) => s.key !== "vip");
  return filtered[0] ?? null;
}
