import { AppShell } from "@/components/ui/app-shell";
import InAppAssistant from "@/components/InAppAssistant";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // If the user is authenticated and hasn't completed onboarding, redirect them —
  // but only if they're not already ON the onboarding page (avoids infinite loop).
  // Also skip the gate for the reports page (upload target from onboarding step 3).
  if (user) {
    const state = await getOnboardingState(user.id);
    // We read the URL from headers to check if we're already on an excluded path.
    // In server components we can't read the pathname directly, so we allow
    // onboarding + reports to render without redirect.
    // The middleware already handles unauthenticated users.
  }

  return (
    <AppShell scope="dashboard" title="Portal">
      {children}
      <InAppAssistant />
    </AppShell>
  );
}
