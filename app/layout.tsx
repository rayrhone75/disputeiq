import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";

import { BRAND, URLS } from "@/lib/urls";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { ConvexClerkProvider } from "@/components/providers/ConvexClerkProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

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
  // suppressHydrationWarning on <html>/<body> swallows extension-injected
  // attributes (e.g. Smart Converter, Grammarly, ColorZilla) that diff the
  // first render. Scoped to these two tags only — children still get full
  // hydration validation.
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ConvexClerkProvider>
            {children}
            <PwaInstallPrompt />
          </ConvexClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
