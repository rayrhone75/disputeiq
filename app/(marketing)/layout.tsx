import type { ReactNode } from "react";
import AIChatWidget from "@/components/AIChatWidget";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070a14] text-white">
      {children}
      <AIChatWidget />
    </div>
  );
}
