"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CustomerHeader } from "./_components/CustomerHeader";
import { AccountControls } from "./_components/AccountControls";
import { CreditFileSummary } from "./_components/CreditFileSummary";
import { SupportCenter } from "./_components/SupportCenter";
import { Timeline } from "./_components/Timeline";
import { ActionRail } from "./_components/ActionRail";
import { MessagesPanel } from "./_components/MessagesPanel";
import { HealthSignals } from "./_components/HealthSignals";
import { ToastProvider } from "./_components/toast";
import {
  aggregate,
  type Customer360Payload,
  type CustomerNote,
  type CustomerFollowUp,
  type CustomerThread,
} from "./_components/types";

// Customer 360 — fat client orchestrator. Wraps everything in a
// ToastProvider so admin actions can surface success/error pills.

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: Customer360Payload }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export function Customer360Client({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(userId)}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        console?: Customer360Payload["console"];
        timeline?: Customer360Payload["timeline"];
        notes?: CustomerNote[];
        followUps?: CustomerFollowUp[];
        threads?: CustomerThread[];
      };
      if (res.status === 404 || data.code === "NOT_FOUND") {
        setState({ kind: "missing" });
        return;
      }
      if (data.ok && data.console) {
        setState({
          kind: "ready",
          data: {
            console: data.console,
            timeline: data.timeline ?? [],
            notes: data.notes ?? [],
            followUps: data.followUps ?? [],
            threads: data.threads ?? [],
          },
        });
        return;
      }
      setState({
        kind: "error",
        message: data.message ?? "Could not load customer.",
      });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <ToastProvider>
      <Body state={state} userId={userId} onRefresh={load} />
    </ToastProvider>
  );
}

function Body({
  state,
  userId,
  onRefresh,
}: {
  state: State;
  userId: string;
  onRefresh: () => void;
}) {
  if (state.kind === "loading") return <Skeleton />;
  if (state.kind === "missing") return <Missing userId={userId} />;
  if (state.kind === "error")
    return <ErrorState message={state.message} userId={userId} />;

  const agg = aggregate(state.data);
  const needsHelp =
    agg.riskBadge === "needs_help" || agg.riskBadge === "stalled";

  return (
    <div className="space-y-6">
      <NavBar />

      <CustomerHeader console={state.data.console} agg={agg} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <AccountControls
            console={state.data.console}
            onChange={onRefresh}
          />
          <HealthSignals
            console={state.data.console}
            threads={state.data.threads}
            timeline={state.data.timeline}
            followUps={state.data.followUps}
          />
          <MessagesPanel
            customerId={state.data.console.user._id}
            initialThreads={state.data.threads}
            onChange={onRefresh}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <CreditFileSummary
              console={state.data.console}
              agg={agg}
              timeline={state.data.timeline}
            />
            <SupportCenter
              customerId={state.data.console.user._id}
              notes={state.data.notes}
              followUps={state.data.followUps}
              timeline={state.data.timeline}
              needsHelp={needsHelp}
              needsHelpReason={agg.riskReason}
              onChange={onRefresh}
            />
          </div>
          <Timeline rows={state.data.timeline} />
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ActionRail
            customerId={state.data.console.user._id}
            onChange={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <div className="flex items-center justify-between text-sm">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 font-medium text-fg-muted hover:text-fg"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <path
            d="M10 4L6 8l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Customers
      </Link>
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle sm:inline">
        Admin · Customer 360
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-3xl bg-surface-muted/70" />
      <div className="h-32 animate-pulse rounded-3xl bg-surface-muted/70" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-3xl bg-surface-muted/70" />
        <div className="h-56 animate-pulse rounded-3xl bg-surface-muted/70" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-surface-muted/70" />
    </div>
  );
}

function Missing({ userId }: { userId: string }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
        Customer not found
      </h2>
      <p className="mt-2 text-sm text-amber-900/75 dark:text-amber-200/80">
        ID <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">{userId}</code> doesn&apos;t match any user. They may have been archived.
      </p>
      <Link
        href="/admin/customers"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Back to customers
      </Link>
    </section>
  );
}

function ErrorState({ message, userId }: { message: string; userId: string }) {
  return (
    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
      <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-200">
        Couldn&apos;t load this customer
      </h2>
      <p className="mt-2 text-sm text-rose-900/75 dark:text-rose-200/80">
        {message}. ID <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">{userId}</code>.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
      >
        Retry
      </button>
    </section>
  );
}
