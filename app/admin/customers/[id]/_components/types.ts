// Lightweight types for the Admin Customer 360.
//
// Mirrors the JSON shape returned by the customer-console API.
// We don't re-import Convex's generated types here — the API
// JSON-serializes everything (Date / Id → string), and these are the
// shapes we actually consume.

export type CustomerUser = {
  _id: string;
  clerkUserId: string;
  email: string;
  role: string;
  isGraceUser: boolean;
  archivedAt?: number | null;
  archivedReason?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CustomerSubscription = null | {
  status: string;
  planCode: string;
  cycleStart: number;
  cycleEnd: number;
  includedPackets: number;
  overagePacketPriceCents: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export type CustomerProfile = null | {
  _id: string;
  fullName: string;
};

export type CustomerImport = {
  _id: string;
  provider: string;
  status: string;
  bureauCoverage?: string[];
  importMethod?: string;
  createdAt: number;
  updatedAt: number;
  normalizedAt?: number | null;
  _count: {
    tradelines: number;
    collections: number;
    disputeCandidates: number;
  };
};

export type CustomerDispute = {
  _id: string;
  status: string;
  createdAt: number;
  mailedAt?: number | null;
  tradelineId?: string | null;
  aiReasonSummary?: string | null;
  legalBasisSummary?: string | null;
};

export type CustomerPayment = {
  _id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: number;
  description?: string | null;
};

export type CustomerConsent = {
  _id: string;
  consentType: string;
  version: string;
  acceptedAt: number;
};

export type CustomerConsole = {
  user: CustomerUser;
  profile: CustomerProfile;
  subscription: CustomerSubscription;
  creditImports: CustomerImport[];
  disputes: CustomerDispute[];
  payments: CustomerPayment[];
  consentReceipts: CustomerConsent[];
};

export type TimelineRow = {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: number;
  metadataJson?: Record<string, unknown> | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
};

export type Customer360Payload = {
  console: CustomerConsole;
  timeline: TimelineRow[];
};

export type Aggregates = {
  latestImport: CustomerImport | null;
  bureausDetected: Set<string>;
  totalTradelines: number;
  totalNegatives: number;
  totalCandidates: number;
  disputesSent: number;
  disputesInFlight: number;
  deletions: number;
  remaining: number;
  verified: number;
  responseReceived: number;
  escalationReady: number;
  draftReady: number;
  totalSpentCents: number;
  riskBadge: "vip" | "needs_help" | "active" | "stalled" | "new";
  riskReason: string;
};

const DISPUTE_INFLIGHT = new Set([
  "PAID",
  "MAILED",
  "DELIVERED",
  "RESPONSE_RECEIVED",
]);

export function aggregate(data: Customer360Payload): Aggregates {
  const imports = data.console.creditImports;
  const disputes = data.console.disputes;
  const payments = data.console.payments;
  imports.sort((a, b) => b.createdAt - a.createdAt);
  const latest = imports[0] ?? null;

  const totalTradelines = imports.reduce(
    (sum, imp) => sum + (imp._count?.tradelines ?? 0),
    0,
  );
  const totalCandidates = imports.reduce(
    (sum, imp) => sum + (imp._count?.disputeCandidates ?? 0),
    0,
  );
  const totalNegatives = imports.reduce(
    (sum, imp) => sum + (imp._count?.collections ?? 0),
    0,
  );

  const disputesSent = disputes.filter(
    (d) => d.status !== "DRAFT" && d.status !== "READY_FOR_PAYMENT",
  ).length;
  const disputesInFlight = disputes.filter((d) =>
    DISPUTE_INFLIGHT.has(d.status),
  ).length;
  const deletions = disputes.filter((d) => d.status === "CLOSED").length;
  const draftReady = disputes.filter(
    (d) => d.status === "DRAFT" || d.status === "READY_FOR_PAYMENT",
  ).length;
  const responseReceived = disputes.filter(
    (d) => d.status === "RESPONSE_RECEIVED",
  ).length;
  const escalationReady = disputes.filter(
    (d) => d.status === "ESCALATION_READY",
  ).length;
  const remaining = Math.max(0, totalTradelines - disputesSent - deletions);
  const verified = Math.max(0, totalTradelines - disputesInFlight - deletions);

  const bureausDetected = new Set<string>();
  for (const imp of imports) {
    for (const b of imp.bureauCoverage ?? []) bureausDetected.add(b);
  }

  const totalSpentCents = payments
    .filter((p) => p.status === "succeeded" || p.status === "paid")
    .reduce((sum, p) => sum + (p.amountCents ?? 0), 0);

  const { badge, reason } = riskFor({
    user: data.console.user,
    sub: data.console.subscription,
    importsCount: imports.length,
    disputesInFlight,
    deletions,
    escalationReady,
    responseReceived,
    totalSpentCents,
    daysSinceJoin:
      (Date.now() - data.console.user.createdAt) / (1000 * 60 * 60 * 24),
  });

  return {
    latestImport: latest,
    bureausDetected,
    totalTradelines,
    totalNegatives,
    totalCandidates,
    disputesSent,
    disputesInFlight,
    deletions,
    remaining,
    verified,
    responseReceived,
    escalationReady,
    draftReady,
    totalSpentCents,
    riskBadge: badge,
    riskReason: reason,
  };
}

function riskFor(input: {
  user: CustomerUser;
  sub: CustomerSubscription;
  importsCount: number;
  disputesInFlight: number;
  deletions: number;
  escalationReady: number;
  responseReceived: number;
  totalSpentCents: number;
  daysSinceJoin: number;
}): { badge: Aggregates["riskBadge"]; reason: string } {
  if (input.totalSpentCents >= 50_000) {
    return { badge: "vip", reason: "Lifetime value > $500" };
  }
  if (input.sub?.status === "past_due") {
    return { badge: "needs_help", reason: "Payment past due" };
  }
  if (input.escalationReady > 0) {
    return {
      badge: "needs_help",
      reason: `${input.escalationReady} escalation${input.escalationReady === 1 ? "" : "s"} pending`,
    };
  }
  if (input.responseReceived > 0) {
    return {
      badge: "needs_help",
      reason: `${input.responseReceived} unread bureau response${input.responseReceived === 1 ? "" : "s"}`,
    };
  }
  if (
    input.daysSinceJoin > 7 &&
    input.importsCount === 0
  ) {
    return { badge: "stalled", reason: "No report imported after 7 days" };
  }
  if (input.daysSinceJoin <= 14) {
    return { badge: "new", reason: "Joined less than 2 weeks ago" };
  }
  return { badge: "active", reason: "On track" };
}
