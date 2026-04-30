// Dashboard Advisor — pure rule engine.
//
// Same module powers:
//   - The customer-facing "What to do next" panel (StatsAndAdvisor).
//   - The admin "What the customer sees" parity view in Customer 360
//     so support can preview the customer's current advice without
//     impersonation.
//
// No LLM, no async work. Just deterministic rules over the data the
// dashboardOverview API already returns.

export type AdvisorTone =
  | "violet"
  | "indigo"
  | "emerald"
  | "sky"
  | "amber"
  | "rose";

export type AdvisorIcon =
  | "user"
  | "card"
  | "upload"
  | "send"
  | "inbox"
  | "alert"
  | "sparkle"
  | "celebrate";

export type AdvisorSuggestion = {
  key: string;
  title: string;
  body: string;
  href: string;
  tone: AdvisorTone;
  icon: AdvisorIcon;
};

export type AdvisorInputOverview = {
  onboarding: { hasProfile: boolean; hasSubscription: boolean };
  creditReportStatus: { kind: "not_started" | "in_progress" | "imported" | "failed" };
  packetUsage: { plan: string | null; remaining: number };
  user?: {
    billingOverride?: "free" | "discounted" | "custom" | null;
  };
};

export type AdvisorInputAggregates = {
  totalItems: number;
  removed: number;
  inDispute: number;
  draftReady: number;
  responseReceived: number;
  escalationReady: number;
  /** number of collections detected on the report (separate from "negatives total"). */
  collections?: number;
};

/**
 * Build the advisor list for a customer state. Returns at most 3
 * suggestions ordered from "needs immediate attention" → "next action".
 */
export function deriveAdvisorSuggestions(
  o: AdvisorInputOverview,
  agg: AdvisorInputAggregates,
): AdvisorSuggestion[] {
  const out: AdvisorSuggestion[] = [];
  const isComped = o.user?.billingOverride === "free";

  // Onboarding gates — show in priority order.
  if (!o.onboarding.hasProfile) {
    out.push({
      key: "profile_missing",
      title: "Finish your profile",
      body: "Address and identity details unlock letter generation. Two minutes.",
      href: "/dashboard/onboarding",
      tone: "violet",
      icon: "user",
    });
  }
  // Skip "choose a plan" for comped users — they don't need to pay.
  if (!o.onboarding.hasSubscription && !isComped) {
    out.push({
      key: "no_subscription",
      title: "Choose a plan to start disputing",
      body: "Every plan includes monthly packets, certified mail, and bureau tracking.",
      href: "/dashboard/onboarding",
      tone: "indigo",
      icon: "card",
    });
  }
  if (
    o.creditReportStatus.kind === "not_started" ||
    o.creditReportStatus.kind === "failed"
  ) {
    out.push({
      key:
        o.creditReportStatus.kind === "failed" ? "import_failed" : "no_report",
      title:
        o.creditReportStatus.kind === "failed"
          ? "Retry your report import"
          : "Connect your credit report",
      body: "We'll analyze every tradeline and surface dispute opportunities the moment it lands.",
      href: "/dashboard/get-report",
      tone: o.creditReportStatus.kind === "failed" ? "amber" : "violet",
      icon: "upload",
    });
  }

  // Action gates — most-impactful first.
  if (agg.draftReady > 0) {
    out.push({
      key: "drafts_ready",
      title: `Approve ${agg.draftReady} ${agg.draftReady === 1 ? "letter" : "letters"} ready to mail`,
      body: "Review the draft, approve, and we'll send certified mail tomorrow morning.",
      href: "/dashboard/letters",
      tone: "emerald",
      icon: "send",
    });
  }
  if (agg.responseReceived > 0) {
    out.push({
      key: "responses_received",
      title: `Bureau ${agg.responseReceived === 1 ? "responded" : "responses received"}`,
      body: "Open the dispute timeline to see what they said and decide your next move.",
      href: "/dashboard/disputes",
      tone: "sky",
      icon: "inbox",
    });
  }
  if (agg.escalationReady > 0) {
    out.push({
      key: "escalation_ready",
      title: `Escalate ${agg.escalationReady} stalled ${agg.escalationReady === 1 ? "item" : "items"}`,
      body: "These were delivered but not removed. Time for method-of-verification or CFPB pressure.",
      href: "/dashboard/disputes",
      tone: "rose",
      icon: "alert",
    });
  }
  if (
    typeof agg.collections === "number" &&
    agg.collections > 0 &&
    agg.draftReady === 0 &&
    agg.inDispute === 0 &&
    agg.removed === 0 &&
    o.creditReportStatus.kind === "imported"
  ) {
    out.push({
      key: "collections_ready",
      title: `${agg.collections} ${agg.collections === 1 ? "collection" : "collections"} ready to challenge`,
      body: "Collections are usually the highest-impact items to dispute. Start your first round.",
      href: "/dashboard/disputes",
      tone: "rose",
      icon: "alert",
    });
  }
  if (
    (o.onboarding.hasSubscription || isComped) &&
    o.creditReportStatus.kind === "imported" &&
    agg.totalItems > 0 &&
    agg.inDispute === 0 &&
    agg.removed === 0 &&
    agg.draftReady === 0
  ) {
    out.push({
      key: "first_round",
      title: "Pick your first dispute round",
      body: "Your file is analyzed and ranked. Approve a round to kick off your first packet.",
      href: "/dashboard/disputes",
      tone: "emerald",
      icon: "sparkle",
    });
  }
  if (
    !isComped &&
    o.packetUsage.plan &&
    o.packetUsage.remaining === 0 &&
    agg.draftReady > 0
  ) {
    out.push({
      key: "packet_limit_hit",
      title: "You're at your monthly packet limit",
      body: `Upgrade your plan or pay-per-packet to send the ${agg.draftReady} drafted letters now.`,
      href: "/dashboard/settings",
      tone: "amber",
      icon: "card",
    });
  }
  // Celebration — nudge after first deletion.
  if (agg.removed > 0 && agg.removed <= 2 && agg.escalationReady === 0) {
    out.push({
      key: "first_deletion",
      title: `${agg.removed === 1 ? "First deletion landed!" : `${agg.removed} deletions so far!`}`,
      body: "Great progress — keep the next round moving while the bureaus are warm.",
      href: "/dashboard/disputes",
      tone: "emerald",
      icon: "celebrate",
    });
  }

  return out.slice(0, 3);
}
