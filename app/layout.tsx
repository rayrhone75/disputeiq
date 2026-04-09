import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";

import { BRAND, URLS } from "@/lib/urls";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export const metadata = {
  metadataBase: new URL(URLS.marketing),
  title: `${BRAND.name} — DIY credit workflow platform`,
  description:
    "Review your reports, identify potential inaccuracies, prepare dispute documents, track mailings, and manage evidence.",
  openGraph: {
    title: BRAND.name,
    url: URLS.marketing,
    siteName: BRAND.name,
  },
  appleWebApp: {
    capable: true,
    title: "DisputeIQ",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900">
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
