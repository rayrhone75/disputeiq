import type { Config } from "tailwindcss";

// Helper that produces a Tailwind v3 color string referencing a CSS variable.
// Uses the <alpha-value> placeholder so utilities like bg-canvas/60 work.
const v = (name: string): string => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // Class-based dark mode — toggled via `<html class="dark">` by next-themes.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "ui-serif",
          "Fraunces",
          "Iowan Old Style",
          "Baskerville",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // ─── Semantic theme tokens (preferred for all new code) ──────────
        canvas: v("canvas"),
        "canvas-app": v("canvas-app"),
        surface: v("surface"),
        "surface-muted": v("surface-muted"),
        "surface-strong": v("surface-strong"),

        fg: v("fg"),
        "fg-muted": v("fg-muted"),
        "fg-subtle": v("fg-subtle"),
        "fg-on-strong": v("fg-on-strong"),

        border: v("border"),
        "border-strong": v("border-strong"),
        "border-subtle": v("border-subtle"),

        accent: {
          DEFAULT: v("accent"),
          strong: v("accent-strong"),
          soft: v("accent-soft"),
          fg: v("accent-fg"),
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#6366f1",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
        },

        success: {
          DEFAULT: v("success"),
          fg: v("success-fg"),
          soft: v("success-soft"),
          500: "#10b981",
          600: "#059669",
        },
        warning: {
          DEFAULT: v("warning"),
          fg: v("warning-fg"),
          soft: v("warning-soft"),
          500: "#f59e0b",
          600: "#d97706",
        },
        danger: {
          DEFAULT: v("danger"),
          fg: v("danger-fg"),
          soft: v("danger-soft"),
          500: "#ef4444",
          600: "#dc2626",
        },

        // Legacy ink scale kept so existing components compile. The semantic
        // tokens above are the preferred path for all new/migrated code.
        ink: {
          50: "#f5f7fa",
          100: "#e9edf3",
          200: "#cdd5e0",
          300: "#a4b0c2",
          400: "#6b7a93",
          500: "#475569",
          600: "#334155",
          700: "#1f2a44",
          800: "#121a30",
          900: "#0a1020",
          950: "#060a18",
        },
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
        cardHover:
          "0 1px 0 0 rgb(15 23 42 / 0.06), 0 16px 32px -16px rgb(15 23 42 / 0.18)",
        ring: "0 0 0 1px rgb(15 23 42 / 0.06)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      backgroundImage: {
        "ink-radial":
          "radial-gradient(1200px 600px at 80% -20%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(800px 400px at -10% 10%, rgba(16,185,129,0.10), transparent 60%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
