import "./globals.css";
import type { ReactNode } from "react";

import { BRAND, URLS } from "@/lib/urls";

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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900">{children}</body>
    </html>
  );
}
