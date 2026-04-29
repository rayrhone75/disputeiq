"use client";

import type { Aggregates, CustomerConsole } from "./types";

// Customer header — name, email, plan, status, joined, last login,
// and a risk badge derived from the data we have. Premium feel: large
// avatar disc, gradient accent bar, status pills.

export function CustomerHeader({
  console: c,
  agg,
}: {
  console: CustomerConsole;
  agg: Aggregates;
}) {
  const planLabel = c.subscription
    ? `${c.subscription.planCode} · ${formatStatus(c.subscription.status)}`
    : "No active plan";
  const planTone = subscriptionTone(c.subscription?.status ?? null);
  const joined = formatDate(c.user.createdAt);
  const updated = formatRelative(c.user.updatedAt);
  const initials = initialsFor(c.profile?.fullName ?? c.user.email);
  const fullName = c.profile?.fullName ?? c.user.email.split("@")[0];

  return (
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-1 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.55)]">
      <div className="relative rounded-[calc(theme(borderRadius.3xl)-4px)] bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-semibold text-white shadow-[0_18px_48px_-18px_rgba(99,102,241,0.6)] ring-4 ring-white/40">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Customer 360
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                {fullName}
              </h1>
              <p className="mt-1 truncate text-sm text-fg-muted">
                {c.user.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pill tone={planTone}>{planLabel}</Pill>
                <Pill tone="neutral">
                  Joined {joined}
                </Pill>
                <Pill tone="neutral">Last activity {updated}</Pill>
                {c.user.archivedAt && (
                  <Pill tone="rose">Archived</Pill>
                )}
              </div>
            </div>
          </div>

          <RiskBadge badge={agg.riskBadge} reason={agg.riskReason} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <Mini label="Tradelines" value={agg.totalTradelines} />
          <Mini
            label="Disputes sent"
            value={agg.disputesSent}
            tone="indigo"
          />
          <Mini label="Deletions" value={agg.deletions} tone="emerald" />
          <Mini
            label="Lifetime spend"
            value={agg.totalSpentCents > 0 ? formatMoney(agg.totalSpentCents) : "$0"}
          />
        </div>
      </div>
    </section>
  );
}

function RiskBadge({
  badge,
  reason,
}: {
  badge: Aggregates["riskBadge"];
  reason: string;
}) {
  const meta: Record<
    typeof badge,
    { label: string; tone: string; ring: string; dot: string }
  > = {
    vip: {
      label: "VIP",
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
      ring: "ring-amber-200/70 dark:ring-amber-500/30",
      dot: "bg-amber-500",
    },
    needs_help: {
      label: "Needs help",
      tone: "bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
      ring: "ring-rose-200/70 dark:ring-rose-500/30",
      dot: "bg-rose-500",
    },
    stalled: {
      label: "Stalled",
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
      ring: "ring-amber-200/70 dark:ring-amber-500/30",
      dot: "bg-amber-500",
    },
    new: {
      label: "New",
      tone: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
      ring: "ring-sky-200/70 dark:ring-sky-500/30",
      dot: "bg-sky-500",
    },
    active: {
      label: "Active",
      tone: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
      ring: "ring-emerald-200/70 dark:ring-emerald-500/30",
      dot: "bg-emerald-500",
    },
  };
  const m = meta[badge];
  return (
    <div
      className={`shrink-0 rounded-2xl px-4 py-3 ring-1 ${m.tone} ${m.ring}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </div>
      <p className="mt-1 max-w-[18ch] text-[12px] leading-5">{reason}</p>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "emerald" | "indigo" | "amber" | "rose";
}) {
  const tones: Record<typeof tone, string> = {
    neutral: "bg-surface-muted text-fg-muted ring-border",
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
    indigo:
      "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-500/30",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
    rose:
      "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "indigo";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-200"
      : tone === "indigo"
        ? "text-indigo-700 dark:text-indigo-200"
        : "text-fg";
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function subscriptionTone(
  status: string | null,
): "neutral" | "emerald" | "amber" | "rose" {
  if (!status) return "neutral";
  if (status === "active") return "emerald";
  if (status === "trialing") return "emerald";
  if (status === "past_due" || status === "unpaid") return "rose";
  if (status === "canceled" || status === "incomplete") return "amber";
  return "neutral";
}

function formatStatus(s: string): string {
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function initialsFor(text: string): string {
  if (!text) return "·";
  const parts = text.replace(/@.*$/, "").split(/[ .\-_+]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
}
