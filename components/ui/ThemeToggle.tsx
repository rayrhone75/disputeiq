"use client";

// Compact light/dark/system toggle. Cycles: light → dark → system → light.
// Renders nothing until mounted to avoid SSR/hydration flicker — next-themes
// only knows the resolved theme on the client.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Render a placeholder shell while we're SSR or pre-hydration. Same size
  // as the real button so the layout doesn't jump.
  if (!mounted) {
    return (
      <span
        aria-hidden
        className={[
          "inline-block h-9 w-9 rounded-xl border border-border-strong",
          className,
        ].join(" ")}
      />
    );
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const isDarkResolved = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme ?? "system"} — click to switch to ${next}`}
      title={`Theme: ${theme ?? "system"}`}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border text-fg-muted transition",
        "border-border-strong hover:bg-surface-muted hover:text-fg",
        className,
      ].join(" ")}
      suppressHydrationWarning
    >
      {isDarkResolved ? (
        // Moon
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
