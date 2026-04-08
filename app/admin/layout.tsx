import { AppShell } from "@/components/ui/app-shell";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell scope="admin" title="Command Center">{children}</AppShell>;
}
