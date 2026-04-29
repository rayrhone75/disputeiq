// Shared types for the customer portal home.
//
// We don't import the Convex-generated types directly because the API
// route serializes everything through JSON.stringify — Date / Id values
// become strings, and we don't need every field. Defining the shape we
// actually consume here keeps the section components decoupled from
// Convex internals.

export type OnboardingStep =
  | "profile"
  | "subscription"
  | "report_connect"
  | "report_pending"
  | "ready";

export type CreditReportStatusKind =
  | "not_started"
  | "in_progress"
  | "imported"
  | "failed";

export type DashboardOverview = {
  reports: Array<{
    _id: string;
    bureau?: string;
    source?: string;
    pulledAt?: number;
    tradelines: Array<{ _id: string }>;
  }>;
  tradelines: Array<{
    _id: string;
    bureau?: string;
    creditorName?: string;
    statusLabel?: string;
    isDerogatory?: boolean;
    isCollection?: boolean;
  }>;
  disputes: Array<{
    _id: string;
    status: string;
    tradelineId?: string | null;
    aiReasonSummary?: string | null;
    legalBasisSummary?: string | null;
    mailedAt?: number | null;
    tradeline?: {
      _id: string;
      creditorName?: string;
      bureau?: string;
    } | null;
  }>;
  mailJobs: Array<{
    _id: string;
    disputeCaseId?: string;
    providerJobId?: string | null;
    trackingCode?: string | null;
    status: string;
    deliveredAt?: number | null;
    createdAt: number;
  }>;
  freezes: Array<{
    _id: string;
    provider: string;
    status: string;
  }>;
  subscription: null | {
    status: string;
    planCode: string;
    includedPackets: number;
    cycleStart: number;
    cycleEnd: number;
    overagePacketPriceCents: number;
  };
  packetUsage: {
    plan: string | null;
    included: number;
    used: number;
    remaining: number;
    cycleStart: number | null;
    cycleEnd: number | null;
    overagePriceCents: number;
  };
  creditReportStatus: {
    kind: CreditReportStatusKind;
    latestImportId: string | null;
    latestImportStatus: string | null;
    legacyReportCount: number;
    hasClickedIdiq: boolean;
    lastUpdatedAt: number | null;
  };
  onboarding: {
    step: OnboardingStep;
    hasProfile: boolean;
    hasSubscription: boolean;
    subscriptionStatus: string | null;
    reportCount: number;
    tradelineCount: number;
  };
  user: {
    id: string;
    email: string;
    isGraceUser: boolean;
  };
};

export type Aggregates = {
  totalItems: number;
  removed: number;
  inDispute: number;
  remaining: number;
  verified: number;
  delivered: number;
  draftReady: number;
  awaitingResponse: number;
  responseReceived: number;
  escalationReady: number;
  bureausDetected: Set<string>;
  /** repair-progress as a 0..100 integer */
  repairProgress: number;
};

const DISPUTE_OPEN_STATUSES = new Set([
  "DRAFT",
  "READY_FOR_PAYMENT",
  "PAID",
  "MAILED",
  "DELIVERED",
  "RESPONSE_RECEIVED",
  "ESCALATION_READY",
]);

const DISPUTE_INFLIGHT_STATUSES = new Set([
  "PAID",
  "MAILED",
  "DELIVERED",
  "RESPONSE_RECEIVED",
]);

export function computeAggregates(o: DashboardOverview): Aggregates {
  const totalItems = o.tradelines.length;
  const removed = o.disputes.filter((d) => d.status === "CLOSED").length;
  const inDispute = o.disputes.filter((d) =>
    DISPUTE_INFLIGHT_STATUSES.has(d.status),
  ).length;
  const draftReady = o.disputes.filter(
    (d) => d.status === "DRAFT" || d.status === "READY_FOR_PAYMENT",
  ).length;
  const escalationReady = o.disputes.filter(
    (d) => d.status === "ESCALATION_READY",
  ).length;
  const responseReceived = o.disputes.filter(
    (d) => d.status === "RESPONSE_RECEIVED",
  ).length;
  const delivered = o.mailJobs.filter((m) => m.status === "DELIVERED").length;
  const awaitingResponse = o.disputes.filter(
    (d) => d.status === "MAILED" || d.status === "DELIVERED",
  ).length;
  const alreadyDisputed = o.disputes.filter((d) =>
    DISPUTE_OPEN_STATUSES.has(d.status) || d.status === "CLOSED",
  ).length;
  const remaining = Math.max(0, totalItems - alreadyDisputed);
  const verified = Math.max(0, totalItems - inDispute - removed);
  const bureausDetected = new Set<string>();
  for (const t of o.tradelines) {
    if (t.bureau) bureausDetected.add(t.bureau);
  }
  // Repair progress = removed items / (removed + remaining negatives).
  // When nothing has been removed yet but the user has tradelines, this
  // is 0%. When everything possible has been removed, 100%.
  const negativeBase = Math.max(
    1,
    removed +
      o.disputes.filter((d) =>
        DISPUTE_OPEN_STATUSES.has(d.status),
      ).length,
  );
  const repairProgress = Math.min(
    100,
    Math.round((removed / negativeBase) * 100),
  );
  return {
    totalItems,
    removed,
    inDispute,
    remaining,
    verified,
    delivered,
    draftReady,
    awaitingResponse,
    responseReceived,
    escalationReady,
    bureausDetected,
    repairProgress,
  };
}
