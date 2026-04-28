"use client";

// Wraps next-themes with the configuration we want app-wide:
//   - class-based theming (matches tailwind.config.ts darkMode: "class")
//   - reads/writes "theme" key in localStorage so the choice persists
//   - defaults to "system" so users on light/dark OS get the matching look
//   - disables CSS transitions while toggling so colors don't lerp
//
// Mounted once at the root layout (above ConvexClerkProvider so the theme
// flips immediately even before Clerk is ready).

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
