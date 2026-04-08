import { AppShell } from "@/components/ui/app-shell";
import InAppAssistant from "@/components/InAppAssistant";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell scope="dashboard" title="Portal">
      {children}
      <InAppAssistant />
    </AppShell>
  );
}
