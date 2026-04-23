// Single source of truth for all pricing and billing constants.
// Every pricing display, checkout calculation, and admin view reads from here.

// Customer-facing credit-monitoring provider. DisputeIQ now uses IdentityIQ
// (IDIQ) as the supported report source for every new customer. Legacy
// rows from the prior MFSN era remain readable in admin/support views,
// but new-user onboarding and marketing CTAs route through IDIQ.
//
// Server code should prefer `loadIdiqConfig()` from
// `lib/integrations/identityiq.ts` so admin-managed settings win over
// this fallback constant.
export const CREDIT_MONITORING = {
  provider: "IdentityIQ",
  monthlyPriceCents: 2495,
  billedSeparately: true,
  required: true,
  affiliateCommissionCents: 850,
  enrollUrl:
    process.env.IDIQ_AFFILIATE_URL ??
    process.env.NEXT_PUBLIC_IDIQ_AFFILIATE_URL ??
    "https://www.identityiq.com/",
  disclosure:
    "IdentityIQ membership is the supported report source for DisputeIQ and is billed separately by IdentityIQ. This charge is not included in your DisputeIQ subscription.",
} as const;

export type PlanCode = "starter" | "pro" | "elite";

export interface Plan {
  code: PlanCode;
  name: string;
  monthlyPriceCents: number;
  includedPackets: number;
  overagePacketPriceCents: number;
  tagline: string;
  features: string[];
}

export const PLANS: Record<PlanCode, Plan> = {
  starter: {
    code: "starter",
    name: "Starter",
    monthlyPriceCents: 6900,
    includedPackets: 1,
    overagePacketPriceCents: 1995,
    tagline: "Best for people starting their first dispute round.",
    features: [
      "1 dispute packet per month",
      "AI credit report review",
      "Dispute letter drafting",
      "Bureau tracking dashboard",
      "Freeze tracker",
      "Document history",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro",
    monthlyPriceCents: 9900,
    includedPackets: 3,
    overagePacketPriceCents: 1995,
    tagline: "Best for customers actively working multiple rounds.",
    features: [
      "3 dispute packets per month",
      "Everything in Starter",
      "Advanced AI guidance",
      "Redispute tools",
      "Faster packet workflow",
      "Stronger progress tracking",
    ],
  },
  elite: {
    code: "elite",
    name: "Elite",
    monthlyPriceCents: 12900,
    includedPackets: 5,
    overagePacketPriceCents: 1995,
    tagline: "Best for customers who want the highest monthly capacity.",
    features: [
      "5 dispute packets per month",
      "Everything in Pro",
      "Priority packet processing",
      "Premium workflow tools",
      "Advanced escalation support content",
    ],
  },
} as const;

export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.pro, PLANS.elite];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatMonthly(cents: number): string {
  return `${formatCents(cents)}/mo`;
}
