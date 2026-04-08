import type { ReactNode } from "react";
import AIChatWidget from "@/components/AIChatWidget";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f5ee] text-[#0a0f1c] antialiased [font-feature-settings:'ss01','cv11']">
      <SiteNav />
      {children}
      <SiteFooter />
      <AIChatWidget />
    </div>
  );
}
