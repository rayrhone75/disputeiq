"use client";

import { useState } from "react";
import { ConnectReportPanel } from "@/components/dashboard/ConnectReportPanel";

// "Need another option?" — collapsed by default. The single "what to
// do if the Connector doesn't work for you" disclosure on the page.
// Exposes three escape hatches behind one click:
//   1. Drag & drop a PDF (via ConnectReportPanel)
//   2. Paste report text (via ConnectReportPanel)
//   3. Open the legacy bookmarklet flow (via onBookmarklet callback)
//
// The bookmarklet used to be its own collapsible above this card. Two
// adjacent "fallback" disclosures with overlapping intent confused the
// read — one consolidated card is clearer.

const DEFAULT_JSON_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

export function FallbackOptions({
  onBookmarklet,
}: {
  onBookmarklet?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-muted/40"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path
                d="M8 2v8m0-8l-3 3m3-3l3 3M3 13h10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold text-fg">
              Need another option?
            </div>
            <div className="text-[12px] text-fg-muted">
              Upload a PDF or paste your report manually.
            </div>
          </div>
        </div>
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 text-fg-muted transition ${open ? "rotate-180" : ""}`}
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

      {open && (
        <div className="border-t border-border p-1">
          <ConnectReportPanel
            jsonReportUrl={DEFAULT_JSON_URL}
            retryImportId={null}
          />
          {onBookmarklet && (
            <div className="border-t border-border px-5 py-4">
              <p className="text-sm font-semibold text-fg">
                Or use the legacy bookmarklet
              </p>
              <p className="mt-1 text-[12px] leading-5 text-fg-muted">
                A drag-to-bookmarks button that imports your report when
                clicked on a MyScoreIQ tab. Less reliable than the
                Connector — some browsers strip <code>javascript:</code>
                URLs on drag — but works without an install.
              </p>
              <button
                type="button"
                onClick={onBookmarklet}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-muted"
              >
                Open bookmarklet flow
              </button>
            </div>
          )}
          <div className="px-5 pb-5 pt-2 text-[11px] leading-5 text-fg-subtle">
            Most customers won&apos;t need this — the Connector above is
            the easy way. These are here for the rare case where the
            extension install fails or you already have a saved file.
          </div>
        </div>
      )}
    </section>
  );
}
