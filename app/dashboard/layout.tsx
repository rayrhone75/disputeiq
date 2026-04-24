import { AppShell } from "@/components/ui/app-shell";
import InAppAssistant from "@/components/InAppAssistant";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // Onboarding state is loaded so future logic can react to it. The
  // middleware already handles unauthenticated redirects, so we don't gate
  // here — `app/dashboard/onboarding/page.tsx` owns the redirect when a
  // user lands on the dashboard root before completing setup.
  if (user) {
    await getOnboardingState();
  }

  return (
    <AppShell scope="dashboard" title="Portal">
      {children}
      <InAppAssistant />
    </AppShell>
  );
}
