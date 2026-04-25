"use client";

import { useState, useRef, useEffect } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "What's the strongest dispute angle in my report?",
  "Which bureau should I focus on first?",
  "What does my next step look like?",
  "Explain the disputes I already have in plain English.",
];

// In-app AI assistant. Talks to /api/ai/assistant which grounds the model in
// the logged-in user's REAL report, dispute, and mail-job state. Refuses to
// reference anything not in that context.
export function AssistantPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your DisputeIQ assistant. I can see your real report, your active disputes, and your certified mail status. Ask me anything about your file.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond." },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border-strong bg-surface">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-fg">AI assistant</h3>
          <p className="text-xs text-fg-muted">
            Grounded in your real report data. Will not invent facts.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          live
        </span>
      </div>

      <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto px-6 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-muted p-3 text-sm text-fg"
                : "ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-indigo-600 p-3 text-sm text-white"
            }
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface-muted p-3 text-sm text-fg-muted">
            Thinking…
          </div>
        )}
        {messages.length <= 1 && (
          <div className="grid gap-2 pt-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-left text-xs text-fg-muted hover:border-indigo-300 hover:bg-indigo-50 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
                suppressHydrationWarning
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !busy) send(input.trim());
        }}
        className="border-t border-border bg-surface-muted/40 p-3"
      >
        <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your report, disputes, or next step…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            suppressHydrationWarning
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-50"
            suppressHydrationWarning
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-[10px] text-fg-subtle">
          Informational only. Not legal or financial advice.
        </p>
      </form>
    </section>
  );
}
