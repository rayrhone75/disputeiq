"use client";

import Link from "next/link";
import type { CustomerConsole } from "./types";

// Account controls — admin-level user actions.
// Per the plan rules, anything we don't actually have working today is
// rendered disabled with a "Coming soon" pill. Two real controls are
// present: a deep link to the user's audit log (already filterable by
// entity) and a Stripe Customer-Portal launcher when we have the
// stripeCustomerId on file.

export function AccountControls({
  console: c,
}: {
  console: CustomerConsole;
}) {
  const stripeCustomerId = c.subscription?.stripeCustomerId ?? null;
  const stripeUrl = stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${stripeCustomerId}`
    : null;

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Account controls
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Manage this customer&apos;s account
          </h3>
        </div>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Action
          icon={<IconKey />}
          title="Send password reset"
          subtitle="Email a Clerk reset link"
          comingSoon
        />
        <Action
          icon={<IconResend />}
          title="Resend onboarding link"
          subtitle="Re-trigger the welcome flow"
          comingSoon
        />
        <Action
          icon={<IconStar />}
          title="Mark VIP"
          subtitle="Pin to top of console"
          comingSoon
        />
        <Action
          icon={<IconGift />}
          title="Comp month"
          subtitle="Waive next billing cycle"
          comingSoon
        />
        <Action
          icon={<IconPercent />}
          title="Apply discount"
          subtitle="Custom % off + duration"
          comingSoon
        />
        {c.subscription?.status === "active" ? (
          <Action
            icon={<IconCancel />}
            title="Cancel subscription"
            subtitle="Pause future billing"
            comingSoon
          />
        ) : (
          <Action
            icon={<IconReactivate />}
            title="Reactivate subscription"
            subtitle="Resume billing"
            comingSoon
          />
        )}
        <Action
          icon={<IconView />}
          title="View as customer"
          subtitle="Read-only impersonation"
          comingSoon
        />
        {stripeUrl ? (
          <ActionLink
            href={stripeUrl}
            icon={<IconStripe />}
            title="Open in Stripe"
            subtitle="Customer dashboard"
            external
          />
        ) : (
          <Action
            icon={<IconStripe />}
            title="Open in Stripe"
            subtitle="No Stripe customer linked"
            disabled
          />
        )}
        <ActionLink
          href={`/admin/audit-logs?userId=${c.user._id}`}
          icon={<IconAudit />}
          title="View audit log"
          subtitle="Every event for this user"
        />
      </div>
    </section>
  );
}

function Action({
  icon,
  title,
  subtitle,
  comingSoon,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      className="group relative flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left opacity-65 transition"
      aria-disabled
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block text-[11px] leading-5 text-fg-muted">
          {subtitle}
        </span>
      </span>
      {comingSoon ? (
        <Tag tone="violet">Coming soon</Tag>
      ) : disabled ? (
        <Tag tone="neutral">Unavailable</Tag>
      ) : null}
    </button>
  );
}

function ActionLink({
  href,
  icon,
  title,
  subtitle,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block text-[11px] leading-5 text-fg-muted">
          {subtitle}
        </span>
      </span>
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-fg-subtle" fill="none">
        <path
          d="M6 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
  const className =
    "group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)]";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "violet" | "neutral";
}) {
  const tones: Record<typeof tone, string> = {
    violet:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    neutral: "bg-surface-muted text-fg-subtle",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// Icons
function IconKey() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle cx="5" cy="11" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 9l6-6m-2 0h2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconResend() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 7a5 5 0 019-3l1 1m-1-1V2m0 2h2M13 9a5 5 0 01-9 3l-1-1m1 1v2m0-2H2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M8 1.5l1.9 4.4 4.6.4-3.5 3.1 1.1 4.6L8 11.7 3.9 14l1.1-4.6L1.5 6.3l4.6-.4L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconGift() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <rect x="2" y="6" width="12" height="3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="9" width="10" height="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 6v8M5 6c0-2 3-2 3 0M11 6c0-2-3-2-3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconPercent() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle cx="5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconCancel() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5l6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconReactivate() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M2 8a6 6 0 1010-4l2-1m-2 1l-1-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconView() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconStripe() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 4h10v8H3z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 7h6M5 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 8h6M5 10h6M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
