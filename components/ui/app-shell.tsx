import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/primitives";

// Command-center layout: premium left rail + executive top bar.
// Used by both /dashboard and /admin via per-segment layouts.

const NAV_DASHBOARD = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/disputes", label: "Disputes" },
  { href: "/dashboard/letters", label: "Letters" },
  { href: "/dashboard/complaints", label: "Complaints" },
  { href: "/dashboard/settings", label: "Settings" },
];

const NAV_ADMIN = [
  { href: "/admin", label: "Command Center" },
  { href: "/admin/pricing", label: "Pricing" },
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
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] flex-col border-r border-ink-100 bg-white/70 px-5 py-7 backdrop-blur lg:flex">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-ink-900 to-accent-600" />
            <div>
              <p className="font-display text-sm font-semibold tracking-tight text-ink-900">DisputeIQ</p>
              <p className="text-[11px] uppercase tracking-widest text-ink-400">{title}</p>
            </div>
          </div>

          <nav className="mt-10 flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-ink-500 transition",
                  "hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                <span>{item.label}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-transparent group-hover:bg-accent-500" />
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-ink-100 bg-gradient-to-br from-white to-ink-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">Status</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">All systems normal</p>
            <p className="mt-1 text-xs text-ink-500">Mailing, payments, audit log healthy.</p>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-ink-100 bg-white/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-ink-900 to-accent-600 lg:hidden" />
              <p className="font-display text-sm font-semibold tracking-tight text-ink-900">{title}</p>
              <span className="hidden rounded-full bg-success-500/10 px-2 py-0.5 text-[11px] font-semibold text-success-600 ring-1 ring-inset ring-success-500/20 sm:inline">
                Live
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-100">Help</button>
              <Link
                href="/sign-in"
                className="rounded-xl bg-ink-900 px-3 py-2 text-sm font-medium text-white hover:bg-ink-800"
              >
                Account
              </Link>
            </div>
          </header>

          <main className="flex-1 px-6 py-10 sm:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
