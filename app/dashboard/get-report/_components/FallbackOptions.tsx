"use client";

import { useState } from "react";
import { ConnectReportPanel } from "@/components/dashboard/ConnectReportPanel";

// "Need another option?" — collapsed by default. Reveals the existing
// PDF upload + paste-text panel for the small fraction of users who
// can't (or don't want to) use the MyScoreIQ Auto-Connect path.
//
// Wraps the existing ConnectReportPanel — its "Drag & drop a PDF" and
// "Paste report text" widgets already handle both file types. We don't
// need to rewrite those flows; we just hide them behind a discreet
// disclosure so the primary path stays clean.

const DEFAULT_JSON_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

export function FallbackOptions() {
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
          <div className="px-5 pb-5 pt-2 text-[11px] leading-5 text-fg-subtle">
            Most customers won&apos;t need this — the Auto-Connect path above
            is the easy way. This is here for cases where you already have a
            saved file or your browser doesn&apos;t support drag-and-drop
            bookmarks.
          </div>
        </div>
      )}
    </section>
  );
}
