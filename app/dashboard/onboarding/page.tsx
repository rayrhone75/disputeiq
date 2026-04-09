import { requireUser } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (state.step === "ready") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-ink-900">Complete your setup</h1>
      <p className="mt-2 text-sm text-ink-600">
        Finish these steps before you can start disputing. Each step takes about a minute.
      </p>
      <OnboardingFlow
        currentStep={state.step}
        hasProfile={state.hasProfile}
        hasSubscription={state.hasSubscription}
        reportCount={state.reportCount}
      />
    </div>
  );
}
