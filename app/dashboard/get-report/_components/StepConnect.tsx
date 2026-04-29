"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkletCard } from "@/components/dashboard/BookmarkletCard";
import { ConnectReportPanel } from "@/components/dashboard/ConnectReportPanel";
import type { Provider } from "./StepProvider";

// Step 2 — Connect.
//
// One large, premium hero CTA that opens the chosen provider in a new
// tab. Below it, the bookmarklet install + a discreet "Need another
// option?" disclosure for manual paste/upload.

const PROVIDER_META: Record<
  Exclude<Provider, "manual">,
  {
    name: string;
    activationUrl: string;
    helperLine: string;
    secondaryLine: string;
    accent: string;
  }
> = {
  identityiq: {
    name: "IdentityIQ",
    // Stable affiliate link; admins can override at deploy time later.
    activationUrl:
      "https://www.identityiq.com/sc-securemax.aspx?offercode=43154800-DIQ",
    helperLine: "We'll open IdentityIQ in a new tab.",
    secondaryLine:
      "Sign in (or start your $1 trial), then come back here — we handle the rest.",
    accent: "from-violet-500 to-indigo-600",
  },
  myscoreiq: {
    name: "MyScoreIQ",
    activationUrl:
      "https://member.myscoreiq.com/get-fico-preferred.aspx?offercode=43214399",
    helperLine: "We'll open MyScoreIQ in a new tab.",
    secondaryLine:
      "Sign in (or start your trial), then come back here — we handle the rest.",
    accent: "from-sky-500 to-blue-600",
  },
  privacyguard: {
    name: "PrivacyGuard",
    activationUrl: "https://www.privacyguard.com/",
    helperLine: "PrivacyGuard launches in a new tab.",
    secondaryLine: "Coming soon — try IdentityIQ for instant access.",
    accent: "from-rose-500 to-amber-500",
  },
};

export function StepConnect({
  provider,
  clerkUserId,
  onChangeProvider,
  onContinueAnyway,
}: {
  provider: Provider;
  clerkUserId: string;
  onChangeProvider: () => void;
  onContinueAnyway: () => void;
}) {
  const [showFallback, setShowFallback] = useState(provider === "manual");

  if (provider === "manual") {
    return (
      <ManualPath
        onChangeProvider={onChangeProvider}
        onContinueAnyway={onContinueAnyway}
      />
    );
  }

  const meta = PROVIDER_META[provider];
  const activationUrl = appendSubId(meta.activationUrl, clerkUserId);

  function recordClick() {
    fetch("/api/idiq/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-8 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">
          Step 2 of 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Connect your credit report
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-fg-muted">
          One click. Your authenticated browser session pulls the report; we
          read it directly — no passwords, nothing stored.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-border">
        <div
          className={`relative bg-gradient-to-br p-8 sm:p-10 lg:p-12 ${meta.accent}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.25),_transparent_60%)]" />
          <div className="relative flex flex-col items-start gap-6 text-white">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90 ring-1 ring-white/30 backdrop-blur">
              {meta.name}
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Connect My Credit Report
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
                {meta.helperLine} {meta.secondaryLine}
              </p>
            </div>
            <a
              href={activationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={recordClick}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-slate-900 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
                <path
                  d="M11 3h6v6m0-6L8 12M9 4H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Open {meta.name}
            </a>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:p-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tip
              n="1"
              title="Open"
              body={`We'll launch ${meta.name} in a new tab.`}
            />
            <Tip
              n="2"
              title="Sign in"
              body="Use your existing account or start a trial."
            />
            <Tip
              n="3"
              title="Come back"
              body="Click the import button — we do the rest."
            />
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-1 dark:border-violet-500/20 dark:bg-violet-500/5">
            <BookmarkletCard />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onChangeProvider}
              className="inline-flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg"
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
              Change provider
            </button>
            <button
              type="button"
              onClick={() => setShowFallback((v) => !v)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg"
              aria-expanded={showFallback}
            >
              Need another option?
              <svg
                viewBox="0 0 16 16"
                className={`h-3.5 w-3.5 transition ${showFallback ? "rotate-180" : ""}`}
                fill="none"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {showFallback && (
            <div className="rounded-2xl border border-border bg-surface-muted/50 p-1">
              <ConnectReportPanel
                jsonReportUrl="https://member.myscoreiq.com/CreditReport.aspx?view=json"
                retryImportId={null}
              />
              <div className="px-5 pb-5 pt-2 text-[11px] text-fg-subtle">
                Already have your report? Paste or upload it here. Most people
                won&apos;t need this — the connect button above is the easy path.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-fg-subtle">
        <button
          type="button"
          onClick={onContinueAnyway}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
        >
          I already imported — refresh status
        </button>
        <p>
          Trouble? <Link href="/dashboard" className="underline">Contact support</Link> — we&apos;ll guide you through.
        </p>
      </div>
    </section>
  );
}

function ManualPath({
  onChangeProvider,
  onContinueAnyway,
}: {
  onChangeProvider: () => void;
  onContinueAnyway: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-8 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300">
          Step 2 of 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Upload your credit report
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-fg-muted">
          Drag-and-drop a PDF, paste plain text, or attach a JSON tri-merge —
          we&apos;ll analyze it the moment it lands.
        </p>
      </header>

      <div className="rounded-3xl bg-surface shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-border">
        <ConnectReportPanel
          jsonReportUrl="https://member.myscoreiq.com/CreditReport.aspx?view=json"
          retryImportId={null}
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-fg-subtle">
        <button
          type="button"
          onClick={onChangeProvider}
          className="text-sm font-semibold text-fg-muted hover:text-fg"
        >
          ← Back to providers
        </button>
        <button
          type="button"
          onClick={onContinueAnyway}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
        >
          I already imported — refresh status
        </button>
      </div>
    </section>
  );
}

function Tip({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fg text-canvas text-xs font-bold">
          {n}
        </div>
        <div className="text-sm font-semibold text-fg">{title}</div>
      </div>
      <p className="mt-2 text-xs leading-5 text-fg-muted">{body}</p>
    </div>
  );
}

function appendSubId(url: string, userId: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("subId")) {
      u.searchParams.set("subId", userId);
    }
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "disputeiq");
    }
    if (!u.searchParams.has("utm_campaign")) {
      u.searchParams.set("utm_campaign", "dashboard_get_report");
    }
    return u.toString();
  } catch {
    return url;
  }
}
