import { AppShell } from "@/components/ui/app-shell";
import InAppAssistant from "@/components/InAppAssistant";
import type { ReactNode } from "react";

// Dashboard layout — intentionally side-effect-free.
//
// We used to fetch onboarding state here during SSR; that coupled every
// dashboard route to Convex availability and contributed to the same
// SSR-fragility we fixed at /dashboard/get-report and /dashboard. Each
// route now fetches the data it needs client-side via fail-soft API
// routes, and middleware already gates the entire /dashboard prefix
// behind a Clerk session.

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell scope="dashboard" title="Portal">
      {children}
      <InAppAssistant />
    </AppShell>
  );
}
