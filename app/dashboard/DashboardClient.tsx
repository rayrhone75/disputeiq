"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BillingPortalButton } from "@/components/dashboard/BillingPortalButton";
import { HelpCard } from "@/components/dashboard/HelpCard";
import {
  PlanComparisonModal,
  UpgradePromptBanner,
  type UpgradeTrigger,
} from "@/components/dashboard/UpgradePrompt";
import type { PlanCode } from "@/lib/billing/plans";
import { HealthHero } from "./_components/HealthHero";
import { NextStepCard } from "./_components/NextStepCard";
import { ProgressTracker } from "./_components/ProgressTracker";
import { StatsAndAdvisor } from "./_components/StatsAndAdvisor";
import { RecentActivity } from "./_components/RecentActivity";
import {
  computeAggregates,
  type DashboardOverview,
} from "./_components/types";

// Customer portal home — fat client orchestrator.
//
// The server wrapper does only the auth check; this component fetches
// /api/dashboard/overview, manages loading/error state, and renders the
// five premium sections. A Convex blip becomes a graceful "we'll show
// what we can" state instead of a 500.

type State =
  | { kind: "loading" }
  | { kind: "ready"; overview: DashboardOverview }
  | { kind: "empty" } // API said ok:false but with no fatal error
  | { kind: "error"; message: string };

export function DashboardClient({ firstName }: { firstName: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [planModalOpen, setPlanModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/overview", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          overview?: DashboardOverview | null;
          message?: string;
        };
        if (cancelled) return;
        if (data.ok && data.overview) {
          setState({ kind: "ready", overview: data.overview });
          return;
        }
        if (data.overview === null) {
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "error",
          message: data.message ?? "Could not load your dashboard.",
        });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return <DashboardSkeleton />;
  }
  if (state.kind === "error") {
    return <DashboardError message={state.message} />;
  }
  if (state.kind === "empty") {
    return <DashboardEmpty firstName={firstName} />;
  }

  const { overview } = state;
  const agg = computeAggregates(overview);
  const subStatus = overview.subscription?.status ?? null;
  const greeting = `${greet()}${firstName ? `, ${firstName}` : ""}`;
  // App-layer billing override controls customer-facing billing UX.
  // When a customer is comped or on a discount, suppress the past-due
  // banner — Stripe may still show past-due upstream, but the customer
  // shouldn't see a payment interrupt for a comped account.
  const override = overview.user.billingOverride ?? null;
  const overrideActive =
    !!override &&
    (!overview.user.billingOverrideExpiresAt ||
      overview.user.billingOverrideExpiresAt > Date.now());
  const showPastDue = subStatus === "past_due" && !overrideActive;
  const showCanceled = subStatus === "canceled" && !overrideActive;
  const upgradeTrigger = pickUpgradeTrigger(overview, agg, overrideActive);

  return (
    <div className="space-y-7">
      {overrideActive && <OverrideBanner override={override!} value={overview.user.billingOverrideValue ?? null} />}
      {/* Past-due is the only billing interrupt that floats to the top
          (and only when the override hasn't suppressed it). */}
      {showPastDue && <PastDueBanner />}
      {showCanceled && <CanceledBanner />}

      <HealthHero
        agg={agg}
        statusKind={overview.creditReportStatus.kind}
        greeting={greeting}
      />

      {upgradeTrigger && (
        <UpgradePromptBanner
          trigger={upgradeTrigger}
          currentPlan={(overview.subscription?.planCode as PlanCode | undefined) ?? null}
          draftReady={agg.draftReady}
          removed={agg.removed}
          onChoosePlan={() => setPlanModalOpen(true)}
        />
      )}

      <NextStepCard overview={overview} agg={agg} />

      {planModalOpen && (
        <PlanComparisonModal
          currentPlan={(overview.subscription?.planCode as PlanCode | undefined) ?? null}
          onClose={() => setPlanModalOpen(false)}
        />
      )}

      <ProgressTracker overview={overview} />

      <StatsAndAdvisor overview={overview} agg={agg} />

      <RecentActivity overview={overview} />

      <HelpCard context="dashboard" />

      <Disclosure />
    </div>
  );
}

function pickUpgradeTrigger(
  o: DashboardOverview,
  agg: ReturnType<typeof computeAggregates>,
  overrideActive: boolean,
): UpgradeTrigger | null {
  // Suppress upgrades when an admin has comped/discounted the account.
  if (overrideActive) return null;
  // Don't pitch upgrades to customers who haven't even chosen a plan yet —
  // the next-step card already routes them to /onboarding.
  if (!o.onboarding.hasSubscription) return null;

  // Highest priority: user is at packet limit AND has letters waiting.
  if (
    o.packetUsage.plan &&
    o.packetUsage.remaining === 0 &&
    agg.draftReady > 0
  ) {
    return "packet_limit";
  }
  // Celebrate the first deletion or two.
  if (agg.removed > 0 && agg.removed <= 2 && o.subscription?.planCode === "starter") {
    return "first_deletion";
  }
  // Many drafts queued on Starter — Pro fits 3.
  if (
    o.subscription?.planCode === "starter" &&
    agg.draftReady >= 2 &&
    o.packetUsage.remaining < agg.draftReady
  ) {
    return "many_drafts";
  }
  return null;
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 5) return "Welcome back";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function OverrideBanner({
  override,
  value,
}: {
  override: "free" | "discounted" | "custom";
  value: number | null;
}) {
  const headline =
    override === "free"
      ? "You're on the house"
      : override === "discounted"
        ? `Discount applied: ${value ?? "—"}% off`
        : `Custom plan active`;
  const body =
    override === "free"
      ? "An admin has comped your account. No charges from DisputeIQ until this is removed."
      : override === "discounted"
        ? "Your subscription is discounted by support. The discount applies until removed."
        : `Your account is on a custom rate set by support${
            typeof value === "number"
              ? ` ($${(value / 100).toFixed(2)} per cycle)`
              : ""
          }.`;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <path d="M3.5 7l3.5 3.5L12.5 4 14 5.5l-7 7L2 7.5z" />
          </svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {headline}
          </h2>
          <p className="mt-0.5 text-[12px] leading-5 text-emerald-900/85 dark:text-emerald-200/85">
            {body}
          </p>
        </div>
      </div>
    </section>
  );
}

function PastDueBanner() {
  return (
    <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-rose-900 dark:text-rose-200">
            Payment failed
          </h2>
          <p className="mt-1 text-sm text-rose-900/75 dark:text-rose-200/80">
            New disputes and certified mail are paused until your payment
            method is updated.
          </p>
        </div>
        <BillingPortalButton className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          Update payment method →
        </BillingPortalButton>
      </div>
    </section>
  );
}

function CanceledBanner() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
            Subscription canceled
          </h2>
          <p className="mt-1 text-sm text-amber-900/75 dark:text-amber-200/80">
            History stays available, but new disputes need an active plan.
          </p>
        </div>
        <Link
          href="/dashboard/onboarding"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Resubscribe →
        </Link>
      </div>
    </section>
  );
}

function Disclosure() {
  return (
    <footer className="rounded-2xl border border-border bg-surface-muted/60 p-5 text-[11px] leading-relaxed text-fg-muted">
      DisputeIQ is a self-directed software platform that helps you analyze
      credit-report data, prepare dispute packets, and track mailing and
      response activity. DisputeIQ is{" "}
      <strong>not a credit-repair agency, law firm, or credit bureau</strong>{" "}
      and does not guarantee deletions, score increases, or specific outcomes.
      You authorize each action yourself. We operate under your existing
      rights as a consumer under the Fair Credit Reporting Act
      (FCRA, 15 U.S.C. §1681 et seq.).
    </footer>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <div className="h-64 animate-pulse rounded-3xl bg-surface-muted/70" />
      <div className="h-32 animate-pulse rounded-3xl bg-surface-muted/70" />
      <div className="h-28 animate-pulse rounded-3xl bg-surface-muted/70" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-surface-muted/70" />
        <div className="h-48 animate-pulse rounded-3xl bg-surface-muted/70" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-surface-muted/70" />
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
      <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-200">
        We hit a snag loading your dashboard
      </h2>
      <p className="mt-2 text-sm text-rose-900/75 dark:text-rose-200/80">
        {message}. Refresh the page — if this keeps happening, head to{" "}
        <Link href="/dashboard/get-report" className="underline">
          /dashboard/get-report
        </Link>{" "}
        to import your file or reach out to support.
      </p>
    </section>
  );
}

function DashboardEmpty({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 p-1 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.55)]">
        <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-canvas-app/95 px-7 py-9 sm:px-10 sm:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-300">
            {firstName ? `Welcome, ${firstName}` : "Welcome to DisputeIQ"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Let&apos;s connect your credit report
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-fg-muted">
            Pull your tri-merge file in one click. We&apos;ll analyze every
            tradeline, find inaccuracies, and prep your dispute strategy.
          </p>
          <Link
            href="/dashboard/get-report"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-fg px-6 py-3.5 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Connect my credit report
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
              <path
                d="M7 5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
