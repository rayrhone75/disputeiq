"use client";

import Link from "next/link";
import { useState } from "react";
import type { CustomerConsole } from "./types";
import { useToast } from "./toast";
import { LinkResultModal } from "./LinkResultModal";

// Account controls — admin-level user actions.
// Phase 1 wires:
//   - Send password reset (revoke sessions + magic link, copyable)
//   - Resend onboarding (magic link with /dashboard/get-report redirect)
//   - Mark VIP / Unmark VIP
//   - View audit log (deep link)
//   - Open in Stripe (deep link if a stripeCustomerId exists)
// Comp month / discount / cancel-reactivate / view-as-customer remain
// "Coming soon".

export function AccountControls({
  console: c,
  onChange,
}: {
  console: CustomerConsole;
  /** Called after a mutation succeeds so the parent can refetch. */
  onChange: () => void;
}) {
  const { push } = useToast();
  const stripeCustomerId = c.subscription?.stripeCustomerId ?? null;
  const stripeUrl = stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${stripeCustomerId}`
    : null;

  const [busy, setBusy] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{
    title: string;
    description: string;
    url: string;
    expiresInSeconds?: number;
    warning?: string | null;
  } | null>(null);

  async function postJson<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    return (await res.json().catch(() => ({}))) as T;
  }

  async function handlePasswordReset() {
    setBusy("password-reset");
    try {
      const r = await postJson<{
        ok: boolean;
        revokedSessions?: number;
        magicLink?: string | null;
        warning?: string | null;
        message?: string;
      }>(`/api/admin/customers/${c.user._id}/password-reset`);
      if (!r.ok) {
        push("error", "Password reset failed", r.message ?? undefined);
        return;
      }
      if (r.magicLink) {
        setLinkModal({
          title: "Password reset link ready",
          description: `Sessions revoked: ${r.revokedSessions ?? 0}. Send this single-use link to the customer. Expires in 1 hour.`,
          url: r.magicLink,
          expiresInSeconds: 60 * 60,
          warning: r.warning,
        });
      } else {
        push(
          "success",
          `Sessions revoked (${r.revokedSessions ?? 0})`,
          r.warning ?? "Customer can use 'Forgot password' on the sign-in page.",
        );
      }
      onChange();
    } catch (err) {
      push("error", "Password reset failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleResendOnboarding() {
    setBusy("onboarding");
    try {
      const r = await postJson<{
        ok: boolean;
        onboardingLink?: string | null;
        expiresInSeconds?: number;
        message?: string;
      }>(`/api/admin/customers/${c.user._id}/resend-onboarding`);
      if (!r.ok || !r.onboardingLink) {
        push("error", "Couldn't generate onboarding link", r.message ?? undefined);
        return;
      }
      setLinkModal({
        title: "Onboarding link ready",
        description:
          "Single-use link that signs the customer in and lands them on Connect Report. Expires in 24 hours.",
        url: r.onboardingLink,
        expiresInSeconds: r.expiresInSeconds ?? 24 * 60 * 60,
      });
      onChange();
    } catch (err) {
      push("error", "Couldn't generate onboarding link", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleVip(targetVip: boolean) {
    setBusy("vip");
    try {
      const r = await postJson<{ ok: boolean; vip?: boolean; message?: string }>(
        `/api/admin/customers/${c.user._id}/vip`,
        { vip: targetVip },
      );
      if (!r.ok) {
        push("error", "Couldn't update VIP", r.message ?? undefined);
        return;
      }
      push(
        "success",
        targetVip ? "Marked as VIP" : "VIP removed",
        targetVip
          ? "This customer now appears as VIP across the admin console."
          : undefined,
      );
      onChange();
    } catch (err) {
      push("error", "Couldn't update VIP", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isVip = !!c.user.isVip;

  return (
    <>
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
          <ActionButton
            icon={<IconKey />}
            title="Send password reset"
            subtitle="Revoke sessions + magic link"
            busy={busy === "password-reset"}
            onClick={handlePasswordReset}
          />
          <ActionButton
            icon={<IconResend />}
            title="Resend onboarding link"
            subtitle="Magic link to Connect Report"
            busy={busy === "onboarding"}
            onClick={handleResendOnboarding}
          />
          <ActionButton
            icon={<IconStar />}
            title={isVip ? "Remove VIP" : "Mark VIP"}
            subtitle={
              isVip ? "Currently flagged as VIP" : "Pin to top of console"
            }
            tone={isVip ? "amber" : "violet"}
            busy={busy === "vip"}
            onClick={() => handleVip(!isVip)}
          />
          <ComingSoonButton
            icon={<IconGift />}
            title="Comp month"
            subtitle="Waive next billing cycle"
          />
          <ComingSoonButton
            icon={<IconPercent />}
            title="Apply discount"
            subtitle="Custom % off + duration"
          />
          {c.subscription?.status === "active" ? (
            <ComingSoonButton
              icon={<IconCancel />}
              title="Cancel subscription"
              subtitle="Pause future billing"
            />
          ) : (
            <ComingSoonButton
              icon={<IconReactivate />}
              title="Reactivate subscription"
              subtitle="Resume billing"
            />
          )}
          <ComingSoonButton
            icon={<IconView />}
            title="View as customer"
            subtitle="Read-only impersonation"
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
            <ComingSoonButton
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

      {linkModal && (
        <LinkResultModal
          title={linkModal.title}
          description={linkModal.description}
          url={linkModal.url}
          expiresInSeconds={linkModal.expiresInSeconds}
          warning={linkModal.warning ?? null}
          onClose={() => setLinkModal(null)}
        />
      )}
    </>
  );
}

function ActionButton({
  icon,
  title,
  subtitle,
  busy,
  onClick,
  tone = "violet",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  busy?: boolean;
  onClick: () => void;
  tone?: "violet" | "amber";
}) {
  const accent =
    tone === "amber"
      ? "bg-amber-50 text-amber-700 group-hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200"
      : "bg-violet-50 text-violet-700 group-hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-200";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group relative flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-[0_18px_48px_-22px_rgba(15,23,42,0.35)] disabled:cursor-progress disabled:opacity-70"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="block text-[11px] leading-5 text-fg-muted">
          {subtitle}
        </span>
      </span>
      {busy && (
        <span className="shrink-0">
          <Spinner />
        </span>
      )}
    </button>
  );
}

function ComingSoonButton({
  icon,
  title,
  subtitle,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      className="group relative flex cursor-not-allowed items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left opacity-65"
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
      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
        {disabled ? "Unavailable" : "Soon"}
      </span>
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

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin text-fg-muted" fill="none">
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
