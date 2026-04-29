"use client";

import Link from "next/link";
import type { Aggregates, DashboardOverview } from "./types";

// Section B — Next-step card.
//
// Replaces the noisy three-banner stack (Subscription / Onboarding /
// Status) with a single card that shows exactly one thing to do next.
// Past-due subscriptions are handled separately at the top of the
// dashboard — those are billing blocks, not hints.

type NextStep = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: "violet" | "emerald" | "amber" | "indigo" | "sky";
  micro?: string;
};

export function NextStepCard({
  overview,
  agg,
}: {
  overview: DashboardOverview;
  agg: Aggregates;
}) {
  const step = pickNextStep(overview, agg);
  const tone = TONES[step.tone];

  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-1 ${tone.gradient}`}
    >
      <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-surface px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${tone.eyebrow}`}
            >
              {step.eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              {step.title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-fg-muted">
              {step.body}
            </p>
            {step.micro && (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                {step.micro}
              </p>
            )}
          </div>
          <Link
            href={step.href}
            className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold shadow-[0_18px_48px_-18px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 ${tone.button}`}
          >
            {step.cta}
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
      </div>
    </section>
  );
}

const TONES: Record<NextStep["tone"], {
  gradient: string;
  eyebrow: string;
  button: string;
}> = {
  violet: {
    gradient: "from-violet-500 to-indigo-600",
    eyebrow: "text-violet-700 dark:text-violet-300",
    button: "bg-violet-600 text-white hover:bg-violet-700",
  },
  emerald: {
    gradient: "from-emerald-500 to-teal-500",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  amber: {
    gradient: "from-amber-500 to-orange-500",
    eyebrow: "text-amber-700 dark:text-amber-300",
    button: "bg-amber-600 text-white hover:bg-amber-700",
  },
  indigo: {
    gradient: "from-indigo-500 to-blue-600",
    eyebrow: "text-indigo-700 dark:text-indigo-300",
    button: "bg-indigo-600 text-white hover:bg-indigo-700",
  },
  sky: {
    gradient: "from-sky-500 to-cyan-500",
    eyebrow: "text-sky-700 dark:text-sky-300",
    button: "bg-sky-600 text-white hover:bg-sky-700",
  },
};

function pickNextStep(o: DashboardOverview, agg: Aggregates): NextStep {
  // Order matters — first match wins.
  if (!o.onboarding.hasProfile) {
    return {
      eyebrow: "Start here",
      title: "Complete your profile",
      body: "We need your mailing address and identity details to generate dispute letters that the bureaus will accept.",
      cta: "Set up profile",
      href: "/dashboard/onboarding",
      tone: "violet",
      micro: "Takes about 2 minutes",
    };
  }
  if (!o.onboarding.hasSubscription) {
    return {
      eyebrow: "Choose your plan",
      title: "Pick a plan to start disputing",
      body: "Starter, Pro, or Elite — every plan includes monthly dispute packets, certified mail, and bureau response tracking.",
      cta: "Choose plan",
      href: "/dashboard/onboarding",
      tone: "indigo",
      micro: "Cancel anytime",
    };
  }
  if (
    o.creditReportStatus.kind === "not_started" ||
    o.onboarding.step === "report_connect"
  ) {
    return {
      eyebrow: "Step 1",
      title: "Connect your credit report",
      body: "Pull your tri-merge file in one click. We'll analyze every tradeline and surface the disputable items automatically.",
      cta: "Connect report",
      href: "/dashboard/get-report",
      tone: "violet",
      micro: "About 60 seconds",
    };
  }
  if (o.creditReportStatus.kind === "failed") {
    return {
      eyebrow: "Action needed",
      title: "Last import didn't finish",
      body: "We'll walk you through reconnecting. Your previous file is preserved while you retry.",
      cta: "Retry import",
      href: "/dashboard/get-report",
      tone: "amber",
    };
  }
  if (
    o.creditReportStatus.kind === "in_progress" ||
    o.onboarding.step === "report_pending"
  ) {
    return {
      eyebrow: "Almost there",
      title: "We're analyzing your file",
      body: "This usually takes under a minute. You can leave this page open — we'll update the moment it's done.",
      cta: "Open analysis",
      href: "/dashboard/get-report",
      tone: "sky",
    };
  }
  if (agg.draftReady > 0) {
    return {
      eyebrow: "Ready to send",
      title: `${agg.draftReady} ${agg.draftReady === 1 ? "letter is" : "letters are"} ready`,
      body: "We've drafted your dispute packets. Review, approve, and we'll handle certified mail and bureau tracking.",
      cta: "Review letters",
      href: "/dashboard/letters",
      tone: "emerald",
      micro: agg.draftReady === 1 ? "1 packet" : `${agg.draftReady} packets`,
    };
  }
  if (agg.responseReceived > 0) {
    return {
      eyebrow: "New responses",
      title: `${agg.responseReceived} bureau ${agg.responseReceived === 1 ? "response" : "responses"} arrived`,
      body: "Open your dispute timeline to see what the bureaus said and decide your next move.",
      cta: "Open disputes",
      href: "/dashboard/disputes",
      tone: "amber",
    };
  }
  if (agg.escalationReady > 0) {
    return {
      eyebrow: "Re-dispute eligible",
      title: `${agg.escalationReady} ${agg.escalationReady === 1 ? "item is" : "items are"} ready to escalate`,
      body: "These items were delivered but not removed. Time to escalate with method-of-verification or CFPB pressure.",
      cta: "Escalate now",
      href: "/dashboard/disputes",
      tone: "amber",
    };
  }
  if (agg.totalItems > 0 && agg.inDispute === 0 && agg.removed === 0) {
    return {
      eyebrow: "Your plan is ready",
      title: "Choose what to dispute",
      body: `We analyzed ${agg.totalItems} tradelines and ranked the strongest dispute opportunities. Approve a round and we'll mail it tomorrow.`,
      cta: "Start disputes",
      href: "/dashboard/disputes",
      tone: "emerald",
    };
  }
  if (agg.awaitingResponse > 0) {
    return {
      eyebrow: "On it",
      title: `${agg.awaitingResponse} ${agg.awaitingResponse === 1 ? "letter" : "letters"} in transit`,
      body: "Bureaus have 30–45 days to respond. We'll alert you the moment a response is recorded.",
      cta: "Track delivery",
      href: "/dashboard/letters",
      tone: "indigo",
    };
  }
  return {
    eyebrow: "All clear",
    title: "Nothing waiting on you",
    body: "Your file is being monitored. We'll surface anything that needs your attention here.",
    cta: "View disputes",
    href: "/dashboard/disputes",
    tone: "indigo",
  };
}
