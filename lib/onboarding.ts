// Onboarding state machine. Determines what a user still needs to complete
// before they can use the dispute workflow.
import { prisma } from "@/lib/prisma";

export type OnboardingStep =
  | "profile"          // no UserProfile yet
  | "subscription"     // no active UserSubscription
  | "report_connect"   // no CreditReport
  | "report_pending"   // report exists but has 0 tradelines
  | "ready";           // everything complete

export interface OnboardingState {
  step: OnboardingStep;
  hasProfile: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  reportCount: number;
  tradelineCount: number;
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [profile, subscription, reportCount, tradelineCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userSubscription.findUnique({ where: { userId } }),
    prisma.creditReport.count({ where: { userId } }),
    prisma.tradeline.count({ where: { report: { userId } } }),
  ]);

  const hasProfile = !!profile;
  const hasSubscription = !!subscription && subscription.status === "active";
  const subscriptionStatus = subscription?.status ?? null;

  let step: OnboardingStep;
  if (!hasProfile) step = "profile";
  else if (!hasSubscription) step = "subscription";
  else if (reportCount === 0) step = "report_connect";
  else if (tradelineCount === 0) step = "report_pending";
  else step = "ready";

  return { step, hasProfile, hasSubscription, subscriptionStatus, reportCount, tradelineCount };
}
