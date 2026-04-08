"use client";

import { useState } from "react";

const QUICK_PROMPTS = [
  "What should I do next?",
  "Explain this account",
  "What documents am I missing?",
  "What changed since last week?",
];

export default function InAppAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Launcher pinned to bottom-right of the app shell */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 shadow-card transition hover:shadow-cardHover"
        aria-label={open ? "Close assistant" : "Open DisputeIQ assistant"}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        DisputeIQ AI
      </button>

      {open && (
        <aside className="fixed bottom-20 right-6 z-40 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-cardHover">
          <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-ink-900 to-accent-600" />
              <div>
                <p className="text-sm font-semibold text-ink-900">DisputeIQ Assistant</p>
                <p className="text-[10px] uppercase tracking-widest text-ink-400">In-app · Beta</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            <div className="rounded-2xl rounded-tl-sm bg-ink-50 p-3 text-ink-700">
              I can help you understand any flagged item, suggest the next step, or explain what's
              happening on your file. Try a prompt below.
            </div>
            <p className="px-1 text-[10px] uppercase tracking-widest text-ink-400">Quick prompts</p>
            <div className="grid gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-left text-[13px] text-ink-700 transition hover:border-accent-400 hover:bg-ink-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="border-t border-ink-100 bg-ink-50/40 p-3"
          >
            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
              <input
                type="text"
                placeholder="Ask about your file…"
                className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-ink-400">
              Informational only. Not legal or financial advice.
            </p>
          </form>
        </aside>
      )}
    </>
  );
}
