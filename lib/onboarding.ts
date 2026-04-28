// Onboarding state — thin wrapper that forwards to Convex.
//
// The actual derivation lives in `convex/onboarding.ts`. This module is
// kept so existing call-sites (`getOnboardingState`) continue to compile;
// it pulls the Clerk token and proxies to the Convex query.

import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export type OnboardingStep =
  | "profile"
  | "subscription"
  | "report_connect"
  | "report_pending"
  | "ready";

export interface OnboardingState {
  step: OnboardingStep;
  hasProfile: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  reportCount: number;
  tradelineCount: number;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) {
    return {
      step: "profile",
      hasProfile: false,
      hasSubscription: false,
      subscriptionStatus: null,
      reportCount: 0,
      tradelineCount: 0,
    };
  }
  const result = (await fetchQuery(api.onboarding.state, {}, { token })) as
    | OnboardingState
    | null;
  if (!result) {
    return {
      step: "profile",
      hasProfile: false,
      hasSubscription: false,
      subscriptionStatus: null,
      reportCount: 0,
      tradelineCount: 0,
    };
  }
  return result;
}
