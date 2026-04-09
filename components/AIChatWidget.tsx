"use client";

import { useState, useRef, useEffect } from "react";

const SUGGESTED = [
  "How do I remove a collection from my report?",
  "What's the fastest legitimate way to raise my score?",
  "Should I dispute online or by mail?",
  "How does DisputeIQ actually work?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm the DisputeIQ assistant. Ask me anything about credit reports, disputes, or what we do. I can also walk you through getting started in under a minute.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(text: string) {
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond." }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Connection error. Try /get-started to start your free analysis." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    send(input.trim());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close DisputeIQ AI" : "Ask DisputeIQ AI"}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(99,102,241,0.6)] backdrop-blur transition hover:scale-[1.02]"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {open ? "Close" : "Ask DisputeIQ AI"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f1a]/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600" />
              <div>
                <p className="text-sm font-semibold">DisputeIQ AI</p>
                <p className="text-[10px] uppercase tracking-widest text-white/50">Online</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "assistant"
                    ? "rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 p-3 leading-relaxed"
                    : "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 p-3 leading-relaxed"
                }
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 p-3 text-white/60">
                Thinking…
              </div>
            )}
            {messages.length <= 1 && (
              <>
                <p className="px-1 text-[11px] uppercase tracking-widest text-white/40">Suggested</p>
                <div className="grid gap-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[13px] text-white/80 hover:border-indigo-400/40 hover:bg-white/[0.06]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <a
                  href="/get-started"
                  className="mt-2 block rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-2 text-center text-[13px] font-semibold"
                >
                  Get your free credit report →
                </a>
              </>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about credit, disputes, security…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
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
