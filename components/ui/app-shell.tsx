import Link from "next/link";
import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessagesNavBadge } from "@/components/ui/MessagesNavBadge";

// Command-center layout: premium left rail + executive top bar.
// Used by both /dashboard and /admin via per-segment layouts.

type NavItem = { href: string; label: string; badge?: "messages" };

const NAV_DASHBOARD: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/get-report", label: "Get Report" },
  { href: "/dashboard/messages", label: "Messages", badge: "messages" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/disputes", label: "Disputes" },
  { href: "/dashboard/letters", label: "Letters" },
  { href: "/dashboard/complaints", label: "Complaints" },
  { href: "/dashboard/settings", label: "Settings" },
];

const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Command Center" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/settings", label: "Platform Settings" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/reports", label: "Report Diagnostics" },
  { href: "/admin/credit-imports", label: "Credit Imports" },
  { href: "/admin/audit-logs", label: "Audit Log" },
  { href: "/admin/mail-jobs", label: "Mail Jobs" },
  { href: "/admin/growth", label: "Growth Console" },
];

export function AppShell({
  scope,
  title,
  children,
}: {
  scope: "dashboard" | "admin";
  title: string;
  children: ReactNode;
}) {
  const nav = scope === "admin" ? NAV_ADMIN : NAV_DASHBOARD;
  return (
    <div className="min-h-screen bg-canvas-app dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] flex-col border-r border-border bg-surface/70 px-5 py-7 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 lg:flex">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-ink-900 to-accent-600" />
            <div>
              <p className="font-display text-sm font-semibold tracking-tight text-fg dark:text-slate-100">
                DisputeIQ
              </p>
              <p className="text-[11px] uppercase tracking-widest text-fg-subtle dark:text-slate-500">
                {title}
              </p>
            </div>
          </div>

          <nav className="mt-10 flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
                  "text-fg-muted hover:bg-surface-muted hover:text-fg",
                  "dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <span>{item.label}</span>
                <span className="flex items-center gap-2">
                  {item.badge === "messages" && <MessagesNavBadge />}
                  <span className="h-1.5 w-1.5 rounded-full bg-transparent group-hover:bg-accent-500" />
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-white to-ink-50 p-4 dark:border-white/10 dark:from-slate-900 dark:to-slate-900/60">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle dark:text-slate-500">
              Status
            </p>
            <p className="mt-1 text-sm font-semibold text-fg dark:text-slate-100">
              All systems normal
            </p>
            <p className="mt-1 text-xs text-fg-muted dark:text-slate-400">
              Mailing, payments, audit log healthy.
            </p>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-surface/70 px-6 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-ink-900 to-accent-600 lg:hidden" />
              <p className="font-display text-sm font-semibold tracking-tight text-fg dark:text-slate-100">
                {title}
              </p>
              <span className="hidden rounded-full bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 ring-1 ring-inset ring-success-500/20 sm:inline">
                Live
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-muted dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                Help
              </button>
              {/* Clerk avatar + dropdown for "Manage account" / "Sign out". */}
              <UserButton />
            </div>
          </header>

          <main className="flex-1 px-6 py-10 sm:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
