"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_LIST, type PlanCode } from "@/lib/billing/plans";

// Phase 6 — Premium upsell.
//
// <UpgradePromptBanner />: a contextual banner that the customer
// dashboard renders only when the user is approaching a value
// inflection point — packet limit hit, first deletion landed, or
// many disputes ready while on the lowest plan. Click → opens
// <PlanComparisonModal>.
//
// <PlanComparisonModal />: side-by-side cards for Starter / Pro /
// Elite using the existing PLAN_LIST + the existing
// /api/subscriptions/create endpoint. We do NOT mint plans inline —
// reuse the wired Stripe checkout flow.

export type UpgradeTrigger =
  | "packet_limit"
  | "first_deletion"
  | "many_drafts"
  | "result_celebration";

export function UpgradePromptBanner({
  trigger,
  currentPlan,
  draftReady,
  removed,
  onChoosePlan,
}: {
  trigger: UpgradeTrigger;
  currentPlan: PlanCode | null;
  draftReady: number;
  removed: number;
  onChoosePlan: () => void;
}) {
  const copy = bannerCopy(trigger, draftReady, removed);
  const tone = bannerTone(trigger);

  return (
    <section
      className={`overflow-hidden rounded-3xl bg-gradient-to-br p-1 shadow-[0_30px_80px_-20px_rgba(99,102,241,0.45)] ${tone.gradient}`}
    >
      <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-surface px-7 py-7 sm:px-9 sm:py-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${tone.eyebrow}`}
            >
              {copy.eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-fg-muted">
              {copy.body}
            </p>
            {currentPlan && (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
                Currently on {planLabel(currentPlan)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onChoosePlan}
            className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold shadow-[0_18px_48px_-18px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 ${tone.button}`}
          >
            See premium plans
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function bannerCopy(
  trigger: UpgradeTrigger,
  draftReady: number,
  removed: number,
): { eyebrow: string; title: string; body: string } {
  if (trigger === "packet_limit") {
    return {
      eyebrow: "Limit reached",
      title: `${draftReady} more letter${draftReady === 1 ? "" : "s"} ready — your plan caps the rest`,
      body: "Upgrade to unlock the rest of your dispute round and ship every letter this cycle.",
    };
  }
  if (trigger === "first_deletion") {
    return {
      eyebrow: "Win",
      title: `${removed === 1 ? "First deletion landed" : `${removed} deletions so far`} — keep the momentum`,
      body: "Pro fits the next round in the same cycle so you can keep pressure on while the bureaus are warm.",
    };
  }
  if (trigger === "many_drafts") {
    return {
      eyebrow: "Pacing",
      title: `${draftReady} packets ready — your current plan won't ship them all`,
      body: "Pro covers 3 packets a month so you don't have to wait between rounds.",
    };
  }
  return {
    eyebrow: "Premium",
    title: "Get the premium DisputeIQ experience",
    body: "Faster packet flow, advanced escalation, priority processing.",
  };
}

function bannerTone(trigger: UpgradeTrigger): {
  gradient: string;
  eyebrow: string;
  button: string;
} {
  if (trigger === "first_deletion") {
    return {
      gradient: "from-emerald-500 to-teal-500",
      eyebrow: "text-emerald-700 dark:text-emerald-300",
      button: "bg-emerald-600 text-white hover:bg-emerald-700",
    };
  }
  if (trigger === "packet_limit") {
    return {
      gradient: "from-amber-500 to-orange-500",
      eyebrow: "text-amber-700 dark:text-amber-300",
      button: "bg-amber-600 text-white hover:bg-amber-700",
    };
  }
  return {
    gradient: "from-violet-500 to-indigo-600",
    eyebrow: "text-violet-700 dark:text-violet-300",
    button: "bg-violet-600 text-white hover:bg-violet-700",
  };
}

function planLabel(code: PlanCode | null): string {
  if (!code) return "no plan";
  const map: Record<PlanCode, string> = {
    starter: "Starter ($69/mo · 1 packet)",
    pro: "Pro ($99/mo · 3 packets)",
    elite: "Elite ($129/mo · 5 packets)",
  };
  return map[code];
}

// ────────────────────────────────────────────────────────────────────

export function PlanComparisonModal({
  currentPlan,
  onClose,
}: {
  currentPlan: PlanCode | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<PlanCode | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function choose(code: PlanCode) {
    setBusy(code);
    setErr(null);
    try {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // No checkout URL — likely already subscribed; offer billing portal.
      if (data.error) {
        setErr(data.error);
      } else {
        // Fall back to onboarding flow's plan picker.
        router.push("/dashboard/onboarding");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare plans"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-surface shadow-[0_40px_100px_-30px_rgba(15,23,42,0.7)]">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Premium plans
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                Choose your plan
              </h3>
              <p className="mt-1 max-w-md text-sm text-white/85">
                Cancel anytime from billing. Plans bill monthly through Stripe;
                MyScoreIQ membership remains separate.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full bg-white/15 p-1.5 text-white/90 ring-1 ring-white/30 hover:bg-white/25"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          {PLAN_LIST.map((plan) => {
            const isCurrent = currentPlan === plan.code;
            const recommended = plan.code === "pro";
            return (
              <div
                key={plan.code}
                className={[
                  "flex flex-col rounded-2xl border p-5 transition",
                  recommended
                    ? "border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 ring-2 ring-violet-300/60 dark:border-violet-500/30 dark:from-violet-500/15 dark:to-indigo-500/10 dark:ring-violet-500/30"
                    : "border-border bg-surface",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold tracking-tight text-fg">
                    {plan.name}
                  </h4>
                  {recommended && (
                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Most popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-fg-muted">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-fg">
                    ${(plan.monthlyPriceCents / 100).toFixed(0)}
                  </span>
                  <span className="text-[12px] text-fg-muted">/mo</span>
                </div>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {plan.includedPackets} packet
                  {plan.includedPackets === 1 ? "" : "s"}/mo · $
                  {(plan.overagePacketPriceCents / 100).toFixed(2)} overage
                </p>
                <ul className="mt-4 space-y-1.5 text-[12px] text-fg-muted">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                        fill="none"
                      >
                        <path
                          d="M3 8.5l3 3 7-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(plan.code)}
                  disabled={isCurrent || busy !== null}
                  className={[
                    "mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                    isCurrent
                      ? "cursor-not-allowed bg-surface-muted text-fg-subtle"
                      : recommended
                        ? "bg-violet-600 text-white hover:bg-violet-700"
                        : "bg-fg text-canvas hover:opacity-90",
                  ].join(" ")}
                >
                  {isCurrent
                    ? "Current plan"
                    : busy === plan.code
                      ? "Loading…"
                      : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {err && (
          <div className="mx-5 mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 sm:mx-6 sm:mb-6">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
