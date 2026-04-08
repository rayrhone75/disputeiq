import Link from "next/link";
import type { ReactNode } from "react";

// Premium UI primitives. Keep API surface tight — these compose into pages.

export function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

// ---------- Buttons ---------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 disabled:opacity-50 disabled:pointer-events-none";

const btnSize: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const btnVariant: Record<ButtonVariant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 shadow-card",
  secondary: "bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-danger-600 text-white hover:bg-danger-500",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  type,
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  type?: "button" | "submit";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(btnBase, btnSize[size], btnVariant[variant], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {children}
    </button>
  );
}

// ---------- Surfaces --------------------------------------------------------
export function Surface({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface surface-hover", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 border-b border-ink-100 pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-500">{eyebrow}</p>
        )}
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------- KPI -------------------------------------------------------------
export function KpiCard({
  label,
  value,
  delta,
  hint,
  intent = "neutral",
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  intent?: "neutral" | "up" | "down";
}) {
  const intentCls =
    intent === "up"
      ? "text-success-600 bg-success-500/10"
      : intent === "down"
      ? "text-danger-600 bg-danger-500/10"
      : "text-ink-500 bg-ink-100";
  return (
    <div className="surface p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-3xl font-semibold tracking-tight text-ink-900">{value}</span>
        {delta && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", intentCls)}>{delta}</span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

// ---------- Chip ------------------------------------------------------------
export type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger";
const chipTone: Record<ChipTone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-100",
  success: "bg-success-500/10 text-success-600 ring-success-500/20",
  warning: "bg-warning-500/10 text-warning-600 ring-warning-500/20",
  danger: "bg-danger-500/10 text-danger-600 ring-danger-500/20",
};
export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        chipTone[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---------- Empty state -----------------------------------------------------
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 opacity-90" />
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action}
    </div>
  );
}

// ---------- Trust banner ----------------------------------------------------
export function TrustBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white/60 p-4 text-xs text-ink-500 backdrop-blur">
      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-success-500" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

// ---------- Section header --------------------------------------------------
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">{title}</h2>
      {action}
    </div>
  );
}

// ---------- Stat row --------------------------------------------------------
export function DataRow({
  label,
  value,
  trailing,
}: {
  label: ReactNode;
  value: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-500">{value}</span>
        {trailing}
      </div>
    </div>
  );
}
