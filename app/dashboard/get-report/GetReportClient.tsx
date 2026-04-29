"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreditReportStatusSummary } from "@/lib/credit-import/status";
import { Stepper, type StepKey } from "./_components/Stepper";
import {
  StepProvider,
  loadStoredProvider,
  persistProvider,
  clearStoredProvider,
  type Provider,
} from "./_components/StepProvider";
import { StepConnect } from "./_components/StepConnect";
import { StepAnalyze } from "./_components/StepAnalyze";
import { StepResults } from "./_components/StepResults";
import type { CreditReportSnapshot } from "@/app/api/credit-report/snapshot/route";

// Orchestrator for the redesigned /dashboard/get-report flow.
//
// Drives a 5-step state machine:
//   provider → connect → analyze → results (+ disputes CTA)
//
// Step transitions:
//   - User clicks a provider card → "connect"
//   - Snapshot.kind becomes "in_progress" → "analyze"
//   - Snapshot.kind becomes "ready" → "results"
//
// Status + snapshot polling lives here. Both endpoints fail soft, so a
// Convex blip leaves the user on whatever step they're on with the data
// they had — never a 500.

const NOT_STARTED: CreditReportStatusSummary = {
  kind: "not_started",
  latestImportId: null,
  latestImportStatus: null,
  legacyReportCount: 0,
  hasClickedIdiq: false,
  lastUpdatedAt: null,
};

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
  clerkUserId,
  welcoming,
  justImported,
}: {
  clerkUserId: string;
  welcoming: boolean;
  justImported: boolean;
}) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [snapshot, setSnapshot] = useState<CreditReportSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<CreditReportStatusSummary>(NOT_STARTED);
  const [loading, setLoading] = useState(true);
  const [analyzeReached, setAnalyzeReached] = useState(false);
  const [resultsReached, setResultsReached] = useState(false);

  // Hydrate provider from sessionStorage after mount.
  useEffect(() => {
    setProvider(loadStoredProvider());
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [snapRes, statusRes] = await Promise.all([
        fetch("/api/credit-report/snapshot", {
          method: "GET",
          cache: "no-store",
        }).then((r) => r.json()),
        fetch("/api/credit-report/status", {
          method: "GET",
          cache: "no-store",
        }).then((r) => r.json()),
      ]);
      if (snapRes?.ok && snapRes.snapshot) {
        setSnapshot(snapRes.snapshot as CreditReportSnapshot);
      } else if (snapRes?.snapshot) {
        // failure but with shape — keep the empty
        setSnapshot(snapRes.snapshot as CreditReportSnapshot);
      }
      if (statusRes?.ok && statusRes.status) {
        const raw = statusRes.status as Omit<CreditReportStatusSummary, "lastUpdatedAt"> & {
          lastUpdatedAt: string | null;
        };
        setStatus({
          ...raw,
          lastUpdatedAt: raw.lastUpdatedAt ? new Date(raw.lastUpdatedAt) : null,
        });
      }
    } catch {
      // leave defaults — page stays usable
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + refetch on `?imported=` param flip.
  useEffect(() => {
    void refreshAll();
  }, [refreshAll, justImported]);

  // Poll while a flow is in flight (provider chosen but not yet imported).
  useEffect(() => {
    if (snapshot.kind === "ready") return;
    if (!provider) return;
    const id = window.setInterval(() => {
      void refreshAll();
    }, 5000);
    return () => window.clearInterval(id);
  }, [provider, snapshot.kind, refreshAll]);

  const currentStep: StepKey = useMemo(() => {
    if (snapshot.kind === "ready" && resultsReached) return "results";
    if (snapshot.kind === "ready") return "analyze"; // briefly, until analyze step unmounts
    if (snapshot.kind === "in_progress" || analyzeReached) return "analyze";
    if (provider) return "connect";
    return "provider";
  }, [snapshot.kind, provider, analyzeReached, resultsReached]);

  const handleSelectProvider = useCallback((p: Provider) => {
    persistProvider(p);
    setProvider(p);
  }, []);

  const handleChangeProvider = useCallback(() => {
    clearStoredProvider();
    setProvider(null);
  }, []);

  const handleContinueAnyway = useCallback(() => {
    setAnalyzeReached(true);
    void refreshAll();
  }, [refreshAll]);

  const handleAnalyzeDone = useCallback(() => {
    setResultsReached(true);
  }, []);

  // If we land on the page with a ready snapshot already (returning user),
  // jump straight to results so they don't re-run the analyze animation.
  useEffect(() => {
    if (loading) return;
    if (snapshot.kind === "ready") {
      setResultsReached(true);
    }
    if (snapshot.kind === "in_progress") {
      setAnalyzeReached(true);
    }
  }, [loading, snapshot.kind]);

  return (
    <div className="min-h-screen bg-canvas-app text-fg">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          welcoming={welcoming}
          justImported={justImported}
          status={status}
        />

        <div className="my-8">
          <Stepper current={currentStep} />
        </div>

        <div className="pb-16">
          {currentStep === "provider" && (
            <StepProvider onSelect={handleSelectProvider} />
          )}

          {currentStep === "connect" && provider && (
            <StepConnect
              provider={provider}
              clerkUserId={clerkUserId}
              onChangeProvider={handleChangeProvider}
              onContinueAnyway={handleContinueAnyway}
            />
          )}

          {currentStep === "analyze" && (
            <StepAnalyze
              imported={snapshot.kind === "ready"}
              onDone={handleAnalyzeDone}
            />
          )}

          {currentStep === "results" && (
            <StepResults snapshot={snapshot} />
          )}
        </div>

        <FooterTrust />
      </div>
    </div>
  );
}

function PageHeader({
  welcoming,
  justImported,
  status,
}: {
  welcoming: boolean;
  justImported: boolean;
  status: CreditReportStatusSummary;
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

      {welcoming && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Welcome to DisputeIQ — your account is ready. Let&apos;s get your credit
          report connected.
        </div>
      )}
      {justImported && status.kind !== "imported" && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
          Your import is processing — refreshing in a moment…
        </div>
      )}
    </div>
  );
}

function FooterTrust() {
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-border pt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor">
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
