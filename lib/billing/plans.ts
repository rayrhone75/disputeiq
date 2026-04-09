// Single source of truth for all pricing and billing constants.
// Every pricing display, checkout calculation, and admin view reads from here.

export const CREDIT_MONITORING = {
  provider: "MyFreeScoreIQ",
  monthlyPriceCents: 2495,
  billedSeparately: true,
  required: true,
  affiliateCommissionCents: 850,
  enrollUrl: "https://app.myfreescorenow.com/enroll/B01B4735",
  disclosure:
    "MyFreeScoreIQ membership is required for report access and monitoring and is billed separately at $24.95/month. This charge is not included in your MyDIY Credit Repair subscription.",
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
