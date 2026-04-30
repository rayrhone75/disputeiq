"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// Admin Automations — feed + filters + per-row actions + sweep button.
// All mutations go through /api/admin/automations[/...]; they fail-soft
// and return JSON so we can surface inline errors instead of 500s.

type Severity = "info" | "warn" | "alert";
type Status = "open" | "reviewed" | "resolved";

type EventRow = {
  _id: string;
  customerId: string;
  ruleKey: string;
  severity: Severity;
  status: Status;
  label: string;
  payloadJson?: Record<string, unknown> | null;
  firstFiredAt: number;
  lastSeenAt: number;
  reviewedAt?: number | null;
  reviewedByUserId?: string | null;
  resolvedAt?: number | null;
  resolvedByUserId?: string | null;
  resolvedReason?: string | null;
  createdAt: number;
  customer: null | {
    _id: string;
    email: string;
    isVip: boolean;
    archivedAt?: number | null;
  };
};

type Counts = {
  open: number;
  alert: number;
  warn: number;
  info: number;
} | null;

type RuleFilter = "all" | "stuck_onboarding" | "billing" | "import_failure" | "dispute_progress" | "vip";

const RULE_GROUPS: Record<Exclude<RuleFilter, "all">, string[]> = {
  stuck_onboarding: ["no_report_24h", "no_disputes_24h", "inactive_3d"],
  billing: ["payment_failed"],
  import_failure: ["import_failed"],
  dispute_progress: ["first_deletion", "no_disputes_24h"],
  vip: ["vip_followup"],
};

const FILTER_LABEL: Record<RuleFilter, string> = {
  all: "All",
  stuck_onboarding: "Stuck onboarding",
  billing: "Billing",
  import_failure: "Import failure",
  dispute_progress: "Dispute progress",
  vip: "VIP",
};

export function AutomationsClient() {
  const [status, setStatus] = useState<Status>("open");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>("all");
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [counts, setCounts] = useState<Counts>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (severity !== "all") params.set("severity", severity);
      params.set("limit", "200");
      const res = await fetch(`/api/admin/automations?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        events?: EventRow[];
        counts?: Counts;
        message?: string;
      };
      if (data.ok) {
        setEvents(data.events ?? []);
        setCounts(data.counts ?? null);
      } else {
        setEvents([]);
        setErr(data.message ?? "Could not load automations.");
      }
    } catch (e) {
      setEvents([]);
      setErr((e as Error).message);
    }
  }, [status, severity]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!events) return null;
    if (ruleFilter === "all") return events;
    const allowed = new Set(RULE_GROUPS[ruleFilter]);
    return events.filter((e) => allowed.has(e.ruleKey));
  }, [events, ruleFilter]);

  async function setRowStatus(id: string, next: Status) {
    setBusy(id);
    try {
      const res = await fetch(
        `/api/admin/automations/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!data.ok) {
        setErr(data.message ?? "Couldn't update event.");
        return;
      }
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runSweep() {
    setBusy("sweep");
    setSweepResult(null);
    try {
      const res = await fetch("/api/admin/automations/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        opened?: number;
        bumped?: number;
        autoResolved?: number;
        sweptUsers?: number;
        message?: string;
      };
      if (!data.ok) {
        setErr(data.message ?? "Sweep failed.");
        return;
      }
      setSweepResult(
        `Swept ${data.sweptUsers ?? 0} customers — ${data.opened ?? 0} new, ${data.bumped ?? 0} re-fired, ${data.autoResolved ?? 0} auto-resolved.`,
      );
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Header counts={counts} onSweep={runSweep} sweepBusy={busy === "sweep"} />

      {sweepResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {sweepResult}
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {err}
        </div>
      )}

      <Filters
        status={status}
        onStatus={setStatus}
        severity={severity}
        onSeverity={setSeverity}
        ruleFilter={ruleFilter}
        onRuleFilter={setRuleFilter}
      />

      <Feed
        events={filtered}
        loading={events === null}
        busyId={busy}
        onMarkReviewed={(id) => setRowStatus(id, "reviewed")}
        onResolve={(id) => setRowStatus(id, "resolved")}
        onReopen={(id) => setRowStatus(id, "open")}
      />
    </div>
  );
}

function Header({
  counts,
  onSweep,
  sweepBusy,
}: {
  counts: Counts;
  onSweep: () => void;
  sweepBusy: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          Automation engine
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Automations
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Customers flagged by automated rules. Mark events reviewed once
          you&apos;ve acted on them; resolve when done. New events show
          here within seconds of running a sweep.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {counts && (
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30">
              {counts.alert} alerts
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
              {counts.warn} warns
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30">
              {counts.info} info
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onSweep}
          disabled={sweepBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {sweepBusy ? "Sweeping…" : "Run sweep"}
        </button>
      </div>
    </header>
  );
}

function Filters({
  status,
  onStatus,
  severity,
  onSeverity,
  ruleFilter,
  onRuleFilter,
}: {
  status: Status;
  onStatus: (s: Status) => void;
  severity: "all" | Severity;
  onSeverity: (s: "all" | Severity) => void;
  ruleFilter: RuleFilter;
  onRuleFilter: (r: RuleFilter) => void;
}) {
  return (
    <section className="rounded-3xl bg-surface p-4 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Group label="Status">
          {(["open", "reviewed", "resolved"] as const).map((s) => (
            <Chip
              key={s}
              active={status === s}
              onClick={() => onStatus(s)}
            >
              {s}
            </Chip>
          ))}
        </Group>
        <Divider />
        <Group label="Severity">
          {(["all", "alert", "warn", "info"] as const).map((s) => (
            <Chip
              key={s}
              active={severity === s}
              onClick={() => onSeverity(s)}
            >
              {s}
            </Chip>
          ))}
        </Group>
        <Divider />
        <Group label="Filter">
          {(Object.keys(FILTER_LABEL) as RuleFilter[]).map((r) => (
            <Chip
              key={r}
              active={ruleFilter === r}
              onClick={() => onRuleFilter(r)}
            >
              {FILTER_LABEL[r]}
            </Chip>
          ))}
        </Group>
      </div>
    </section>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Divider() {
  return <span className="hidden h-5 w-px bg-border sm:inline-block" />;
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
        active
          ? "bg-fg text-canvas"
          : "bg-surface-muted text-fg-muted hover:bg-surface hover:text-fg",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Feed({
  events,
  loading,
  busyId,
  onMarkReviewed,
  onResolve,
  onReopen,
}: {
  events: EventRow[] | null;
  loading: boolean;
  busyId: string | null;
  onMarkReviewed: (id: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-surface-muted/70"
          />
        ))}
      </div>
    );
  }
  if (!events || events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface-muted/40 p-10 text-center">
        <p className="text-sm font-semibold text-fg">No events match</p>
        <p className="mt-1 text-[12px] text-fg-muted">
          Try a wider filter, or run a sweep to refresh.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li
          key={e._id}
          className={[
            "rounded-3xl border bg-surface p-4 transition",
            severityFrame(e.severity),
          ].join(" ")}
        >
          <div className="flex flex-wrap items-start gap-3">
            <SeverityDot severity={e.severity} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${severityPill(e.severity)}`}
                >
                  {e.severity}
                </span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {e.ruleKey.replace(/_/g, " ")}
                </span>
                {e.status !== "open" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      e.status === "resolved"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                        : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"
                    }`}
                  >
                    {e.status}
                    {e.resolvedReason ? ` · ${e.resolvedReason}` : ""}
                  </span>
                )}
                {e.customer?.isVip && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                    ★ VIP
                  </span>
                )}
                <span className="text-[11px] text-fg-subtle">
                  {formatRelative(e.lastSeenAt)}
                  {e.firstFiredAt !== e.lastSeenAt
                    ? ` · first fired ${formatRelative(e.firstFiredAt)}`
                    : ""}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-fg">{e.label}</p>
              <div className="mt-1 text-[12px] text-fg-muted">
                {e.customer ? (
                  <Link
                    href={`/admin/customers/${e.customer._id}`}
                    className="font-medium underline hover:text-fg"
                  >
                    {e.customer.email}
                  </Link>
                ) : (
                  <span className="text-fg-subtle">Customer unknown</span>
                )}
                {summarizePayload(e.payloadJson) && (
                  <span> · {summarizePayload(e.payloadJson)}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {e.status === "open" && (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkReviewed(e._id)}
                    disabled={busyId === e._id}
                    className="rounded-md bg-sky-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(e._id)}
                    disabled={busyId === e._id}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </>
              )}
              {e.status === "reviewed" && (
                <button
                  type="button"
                  onClick={() => onResolve(e._id)}
                  disabled={busyId === e._id}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Resolve
                </button>
              )}
              {e.status === "resolved" && (
                <button
                  type="button"
                  onClick={() => onReopen(e._id)}
                  disabled={busyId === e._id}
                  className="rounded-md border border-border-strong bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg hover:bg-surface-muted disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span
      className={[
        "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        severity === "alert"
          ? "bg-rose-50 dark:bg-rose-500/15"
          : severity === "warn"
            ? "bg-amber-50 dark:bg-amber-500/15"
            : "bg-sky-50 dark:bg-sky-500/15",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          severity === "alert"
            ? "bg-rose-500"
            : severity === "warn"
              ? "bg-amber-500"
              : "bg-sky-500",
        ].join(" ")}
      />
    </span>
  );
}

function severityFrame(s: Severity): string {
  if (s === "alert")
    return "border-rose-200 dark:border-rose-500/30";
  if (s === "warn") return "border-amber-200 dark:border-amber-500/30";
  return "border-sky-200 dark:border-sky-500/30";
}

function severityPill(s: Severity): string {
  if (s === "alert") return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  if (s === "warn") return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
}

function summarizePayload(meta?: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== "object") return "";
  const bits: string[] = [];
  if (typeof meta.hoursSinceSignup === "number") {
    bits.push(`${meta.hoursSinceSignup}h since signup`);
  }
  if (typeof meta.hoursSinceImport === "number") {
    bits.push(`${meta.hoursSinceImport}h since import`);
  }
  if (typeof meta.daysInactive === "number") {
    bits.push(`${meta.daysInactive}d inactive`);
  }
  if (typeof meta.deletions === "number") {
    bits.push(`${meta.deletions} deletions`);
  }
  return bits.slice(0, 3).join(" · ");
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
