"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConnectModal } from "./_components/ConnectModal";
import { HeroLanding } from "./_components/HeroLanding";
import { FallbackOptions } from "./_components/FallbackOptions";
import { TrustRow } from "./_components/TrustRow";
import { StepAnalyze } from "./_components/StepAnalyze";
import { StepResults } from "./_components/StepResults";
import type { CreditReportSnapshot } from "@/app/api/credit-report/snapshot/route";

// Simplified Auto-Connect flow for /dashboard/get-report.
//
// Three top-level states, picked from the snapshot API:
//   - "ready": StepResults — final dashboard with stats + Start Disputes
//   - "in_progress": StepAnalyze — animated AI analysis screen
//   - default: HeroLanding + ConnectModal + FallbackOptions + TrustRow
//
// The five-step provider-selection flow we shipped previously was
// premium but technical; this version collapses to a single primary
// CTA and hides the connector mechanics inside a modal.

const EMPTY_SNAPSHOT: CreditReportSnapshot = {
  kind: "none",
  importId: null,
  bureausDetected: [],
  tradelineCount: 0,
  inquiryCount: 0,
  collectionCount: 0,
  publicRecordCount: 0,
  negativeCount: 0,
  candidateCount: 0,
  importedAt: null,
};

export function GetReportClient({
  welcoming,
  justImported,
}: {
  // clerkUserId reserved for future per-user CTAs; not used in this layout
  // since all token signing now flows through /api/bookmarklet/token.
  clerkUserId: string;
  welcoming: boolean;
  justImported: boolean;
}) {
  const [snapshot, setSnapshot] = useState<CreditReportSnapshot>(EMPTY_SNAPSHOT);
  const [analyzeReached, setAnalyzeReached] = useState(false);
  const [resultsReached, setResultsReached] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-report/snapshot", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        snapshot?: CreditReportSnapshot;
      };
      if (data?.snapshot) {
        setSnapshot(data.snapshot);
      }
    } catch {
      // Leave EMPTY_SNAPSHOT — page stays usable.
    } finally {
      setLoaded(true);
    }
  }, []);

  // Initial load + refresh when ?imported=… changes.
  useEffect(() => {
    void refresh();
  }, [refresh, justImported]);

  // Poll while not yet ready.
  useEffect(() => {
    if (snapshot.kind === "ready") return;
    const id = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [snapshot.kind, refresh]);

  // Auto-advance the perceived state. Once snapshot turns "in_progress"
  // the animated analyze screen takes over; once "ready" we land on
  // results. analyzeReached makes the transition sticky if the snapshot
  // briefly dips back to "none" between polls.
  useEffect(() => {
    if (!loaded) return;
    if (snapshot.kind === "in_progress") setAnalyzeReached(true);
    if (snapshot.kind === "ready") {
      setAnalyzeReached(true);
      setResultsReached(true);
    }
  }, [loaded, snapshot.kind]);

  const phase: "hero" | "analyze" | "results" =
    resultsReached || snapshot.kind === "ready"
      ? "results"
      : analyzeReached || snapshot.kind === "in_progress"
        ? "analyze"
        : "hero";

  const handleConnect = useCallback(() => setModalOpen(true), []);
  const handleClose = useCallback(() => setModalOpen(false), []);
  const handleContinueAnyway = useCallback(() => {
    setModalOpen(false);
    setAnalyzeReached(true);
    void refresh();
  }, [refresh]);
  const handleAnalyzeDone = useCallback(() => {
    setResultsReached(true);
  }, []);

  return (
    <div className="min-h-screen bg-canvas-app text-fg">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader welcoming={welcoming} justImported={justImported} phase={phase} />

        <div className="mt-8 pb-16">
          {phase === "hero" && (
            <div className="space-y-7">
              <HeroLanding onConnect={handleConnect} />
              <FallbackOptions />
              <TrustRow />
            </div>
          )}

          {phase === "analyze" && (
            <StepAnalyze
              imported={snapshot.kind === "ready"}
              onDone={handleAnalyzeDone}
            />
          )}

          {phase === "results" && <StepResults snapshot={snapshot} />}
        </div>

        <FooterTrust />
      </div>

      <ConnectModal
        open={modalOpen}
        onClose={handleClose}
        onContinueAnyway={handleContinueAnyway}
      />
    </div>
  );
}

function PageHeader({
  welcoming,
  justImported,
  phase,
}: {
  welcoming: boolean;
  justImported: boolean;
  phase: "hero" | "analyze" | "results";
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg"
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
          Back to dashboard
        </Link>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle sm:inline">
          DisputeIQ · Get Started
        </span>
      </div>

      {welcoming && phase === "hero" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Welcome to DisputeIQ — your account is ready. Let&apos;s get your
          credit report connected.
        </div>
      )}
      {justImported && phase !== "results" && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
          Your import is processing — we&apos;ll surface your analysis the
          moment it&apos;s ready.
        </div>
      )}
    </div>
  );
}

function FooterTrust() {
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-border pt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
      <span className="inline-flex items-center gap-2">
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 text-emerald-500"
          fill="currentColor"
        >
          <path d="M8 0a4 4 0 014 4v2h.5A1.5 1.5 0 0114 7.5v6A1.5 1.5 0 0112.5 15h-9A1.5 1.5 0 012 13.5v-6A1.5 1.5 0 013.5 6H4V4a4 4 0 014-4z" />
        </svg>
        Bank-level encryption
      </span>
      <span>SOC-aligned hosting</span>
      <span>Cancel anytime</span>
      <span>
        <Link href="/privacy" className="hover:text-fg">
          Privacy
        </Link>
      </span>
      <span>
        <Link href="/terms" className="hover:text-fg">
          Terms
        </Link>
      </span>
    </div>
  );
}
