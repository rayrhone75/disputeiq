"use client";

import type { TimelineRow } from "./types";

// Section 5 — Timeline.
//
// Renders the audit-log feed for the customer (target OR actor) with
// human-readable labels grouped by the kind of event. We don't filter
// by type — every event lands here so admins have the full picture.
// Most-recent first.

const KIND_FOR: Record<string, "import" | "dispute" | "letter" | "payment" | "admin" | "user"> = {
  CREDIT_IMPORT_CREATED: "import",
  CREDIT_IMPORT_RAW_CAPTURED: "import",
  CREDIT_IMPORT_NORMALIZED: "import",
  CREDIT_IMPORT_FAILED: "import",
  BOOKMARKLET_IMPORT_ATTEMPT: "import",
  BOOKMARKLET_IMPORT_SUCCESS: "import",
  BOOKMARKLET_IMPORT_FAILED: "import",
  REPORT_PASTED: "import",
  DISPUTE_CASE_CREATED: "dispute",
  DISPUTE_CASE_UPDATED: "dispute",
  DISPUTE_CASE_CLOSED: "dispute",
  MAIL_JOB_CREATED: "letter",
  MAIL_JOB_DELIVERED: "letter",
  MAIL_JOB_RETURNED: "letter",
  PAYMENT_INTENT_CREATED: "payment",
  PAYMENT_INTENT_SUCCEEDED: "payment",
  PAYMENT_INTENT_FAILED: "payment",
  USER_DELETED: "admin",
  USER_ARCHIVED: "admin",
  USER_PURGED: "admin",
  CREDIT_IMPORT_DELETED: "admin",
};

export function Timeline({ rows }: { rows: TimelineRow[] }) {
  if (!rows.length) {
    return (
      <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
        <Header />
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface-muted/40 p-8 text-center text-sm text-fg-muted">
          No activity yet for this customer.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <Header />

      <ol className="relative mt-6 space-y-4 border-l border-border pl-6">
        {rows.map((row) => {
          const kind = KIND_FOR[row.action] ?? defaultKind(row.action);
          const tone = TONE[kind];
          return (
            <li key={row._id} className="relative">
              <span
                className={[
                  "absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-surface",
                  tone.dot,
                ].join(" ")}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone.inner}`} />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold text-fg">
                  {humanAction(row.action)}
                </div>
                <span className="text-[11px] text-fg-subtle">
                  {formatTime(row.createdAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
                <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.18em] ${tone.pill}`}>
                  {LABEL[kind]}
                </span>
                <span className="truncate">
                  {row.entityType} · {row.entityId.slice(0, 12)}
                </span>
                {summarizeMetadata(row.metadataJson) && (
                  <span className="truncate text-fg-subtle">
                    · {summarizeMetadata(row.metadataJson)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          Activity
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
          Timeline
        </h3>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
        Most recent first
      </span>
    </div>
  );
}

const TONE: Record<
  "import" | "dispute" | "letter" | "payment" | "admin" | "user",
  { dot: string; inner: string; pill: string }
> = {
  import: {
    dot: "bg-violet-100 dark:bg-violet-500/20",
    inner: "bg-violet-500",
    pill:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  },
  dispute: {
    dot: "bg-indigo-100 dark:bg-indigo-500/20",
    inner: "bg-indigo-500",
    pill:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
  },
  letter: {
    dot: "bg-sky-100 dark:bg-sky-500/20",
    inner: "bg-sky-500",
    pill: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  },
  payment: {
    dot: "bg-emerald-100 dark:bg-emerald-500/20",
    inner: "bg-emerald-500",
    pill:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  admin: {
    dot: "bg-rose-100 dark:bg-rose-500/20",
    inner: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  },
  user: {
    dot: "bg-fg/10",
    inner: "bg-fg/60",
    pill: "bg-surface-muted text-fg-muted",
  },
};

const LABEL: Record<keyof typeof TONE, string> = {
  import: "Import",
  dispute: "Dispute",
  letter: "Letter",
  payment: "Payment",
  admin: "Admin",
  user: "Event",
};

function defaultKind(action: string): keyof typeof TONE {
  if (action.includes("PAYMENT")) return "payment";
  if (action.includes("IMPORT") || action.includes("REPORT")) return "import";
  if (action.includes("DISPUTE")) return "dispute";
  if (action.includes("MAIL")) return "letter";
  if (action.includes("USER") || action.includes("ADMIN")) return "admin";
  return "user";
}

function humanAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeMetadata(meta?: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== "object") return "";
  const interesting: string[] = [];
  if (typeof meta.tradelineCount === "number") {
    interesting.push(`${meta.tradelineCount} tradelines`);
  }
  if (typeof meta.candidatesCreated === "number") {
    interesting.push(`${meta.candidatesCreated} candidates`);
  }
  if (typeof meta.code === "string") {
    interesting.push(meta.code);
  }
  if (typeof meta.amountCents === "number") {
    interesting.push(`$${(meta.amountCents / 100).toFixed(2)}`);
  }
  return interesting.slice(0, 2).join(" · ");
}

function formatTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
