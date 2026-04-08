"use client";

import { useState } from "react";

const SUGGESTED = [
  "What does DisputeIQ actually do?",
  "How does certified mail tracking work?",
  "Is my data secure?",
  "What's the difference between plans?",
];

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close DisputeIQ AI" : "Ask DisputeIQ AI"}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(99,102,241,0.6)] backdrop-blur transition hover:scale-[1.02] hover:shadow-[0_12px_50px_-8px_rgba(99,102,241,0.8)]"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {open ? "Close" : "Ask DisputeIQ AI"}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[540px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f1a]/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600" />
              <div>
                <p className="text-sm font-semibold">DisputeIQ AI</p>
                <p className="text-[10px] uppercase tracking-widest text-white/50">Online · Beta</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 p-3 leading-relaxed">
              Hi — I'm the DisputeIQ assistant. I can explain how the platform works, walk you through preparing a
              dispute, or answer questions about security and pricing. What would you like to know?
            </div>
            <p className="px-1 text-[11px] uppercase tracking-widest text-white/40">Suggested</p>
            <div className="grid gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[13px] text-white/80 transition hover:border-indigo-400/40 hover:bg-white/[0.06] hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="border-t border-white/10 bg-black/30 p-3"
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <input
                type="text"
                placeholder="Ask about credit, disputes, security…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-white/40">
              AI responses are informational only. Not legal or financial advice.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
