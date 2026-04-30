"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToastProvider, useToast } from "./_components/toast";

// Customer-facing Messages page.
//
// Layout:
//   - Mobile: single pane that toggles between list and detail.
//   - Desktop: split pane (list on the left, detail on the right).
// Polls the threads list every 30s while the page is open so admin
// replies surface without a manual refresh.

export type Thread = {
  _id: string;
  customerId: string;
  subject?: string | null;
  status: "open" | "resolved";
  resolvedAt?: number | null;
  escalated?: boolean | null;
  lastMessageAt: number;
  lastMessageFrom: "customer" | "admin";
  unreadForCustomer: boolean;
  createdAt: number;
};

export type Message = {
  _id: string;
  threadId: string;
  fromUserId: string;
  fromRole: "customer" | "admin";
  body: string;
  createdAt: number;
};

export function MessagesClient({
  initialThreadId,
}: {
  initialThreadId: string | null;
}) {
  return (
    <ToastProvider>
      <Inner initialThreadId={initialThreadId} />
    </ToastProvider>
  );
}

function Inner({ initialThreadId }: { initialThreadId: string | null }) {
  const { push } = useToast();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialThreadId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composerOpen, setComposerOpen] = useState(initialThreadId === null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/threads", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        threads?: Thread[];
        message?: string;
      };
      if (data.ok && Array.isArray(data.threads)) {
        setThreads(data.threads);
        setLoadError(null);
        return data.threads;
      }
      setLoadError(data.message ?? "Could not load messages.");
      setThreads([]);
      return [];
    } catch (err) {
      setLoadError((err as Error).message);
      setThreads([]);
      return [];
    }
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(
        `/api/messages/threads/${encodeURIComponent(threadId)}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        thread?: Thread;
        messages?: Message[];
        code?: string;
      };
      if (data.ok && data.thread) {
        setThread(data.thread);
        setMessages(data.messages ?? []);
        // Mark read once we've shown it.
        await fetch(
          `/api/messages/threads/${encodeURIComponent(threadId)}/read`,
          { method: "POST" },
        ).catch(() => null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshThreads();
      if (cancelled) return;
      // Pick a thread to render: explicit query param > most recent.
      if (initialThreadId) {
        await loadThread(initialThreadId);
      } else if (list.length > 0) {
        setSelectedId(list[0]._id);
        await loadThread(list[0]._id);
      }
    })();
    const t = window.setInterval(refreshThreads, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [initialThreadId, loadThread, refreshThreads]);

  // When user picks a different thread.
  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  async function handleSend(body: string) {
    if (!selectedId) return;
    const res = await fetch(
      `/api/messages/threads/${encodeURIComponent(selectedId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
    };
    if (!data.ok) {
      push("error", "Couldn't send", data.message ?? undefined);
      return;
    }
    await loadThread(selectedId);
    await refreshThreads();
  }

  async function handleNewThread(subject: string, body: string) {
    const res = await fetch("/api/messages/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject || undefined, body }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      threadId?: string;
      message?: string;
    };
    if (!data.ok || !data.threadId) {
      push("error", "Couldn't start conversation", data.message ?? undefined);
      return;
    }
    push("success", "Sent to support", "We typically respond within a day.");
    setComposerOpen(false);
    setSelectedId(data.threadId);
    await refreshThreads();
  }

  return (
    <div className="space-y-5">
      <Header
        onNew={() => {
          setComposerOpen(true);
          setSelectedId(null);
        }}
      />

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {loadError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Thread list */}
        <aside
          className={[
            "rounded-3xl bg-surface p-2 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]",
            selectedId !== null || composerOpen ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {threads === null ? (
            <SidebarSkeleton />
          ) : threads.length === 0 ? (
            <EmptyList onNew={() => setComposerOpen(true)} />
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setSelectedId(t._id);
                    }}
                    className={[
                      "group flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition",
                      t._id === selectedId
                        ? "border-fg/15 bg-surface-muted/60"
                        : "hover:border-border hover:bg-surface-muted/40",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        t.unreadForCustomer ? "bg-violet-500" : "bg-fg-subtle/30",
                      ].join(" ")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-fg">
                          {t.subject || "Conversation"}
                        </span>
                        <span className="shrink-0 text-[11px] text-fg-subtle">
                          {formatRelative(t.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-muted">
                        <StatusPill status={t.status} escalated={!!t.escalated} />
                        <span>
                          {t.lastMessageFrom === "admin"
                            ? "DisputeIQ replied"
                            : "You messaged"}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Detail / composer */}
        <main
          className={[
            "min-w-0 rounded-3xl bg-surface ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]",
            selectedId === null && !composerOpen ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {composerOpen ? (
            <NewThreadComposer
              onCancel={() => {
                setComposerOpen(false);
                if (threads && threads[0]) setSelectedId(threads[0]._id);
              }}
              onSend={handleNewThread}
            />
          ) : thread ? (
            <ThreadView
              thread={thread}
              messages={messages}
              onSend={handleSend}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <EmptyState onNew={() => setComposerOpen(true)} />
          )}
        </main>
      </div>
    </div>
  );
}

function Header({ onNew }: { onNew: () => void }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          DisputeIQ Support
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Messages
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Talk to the support team. We&apos;ll keep your conversation history
          here for reference.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-fg px-5 py-3 text-sm font-semibold text-canvas hover:opacity-90"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        New message
      </button>
    </header>
  );
}

function StatusPill({
  status,
  escalated,
}: {
  status: "open" | "resolved";
  escalated: boolean;
}) {
  if (escalated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
        Escalated
      </span>
    );
  }
  if (status === "resolved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
      Open
    </span>
  );
}

function ThreadView({
  thread,
  messages,
  onSend,
  onBack,
}: {
  thread: Thread;
  messages: Message[];
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[68vh] min-h-[420px] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted hover:text-fg lg:hidden"
          >
            ← Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-fg sm:text-lg">
              {thread.subject || "Conversation"}
            </h2>
            <StatusPill
              status={thread.status}
              escalated={!!thread.escalated}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Started {formatDateTime(thread.createdAt)} · {messages.length}{" "}
            message{messages.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="text-sm text-fg-muted">No messages yet.</p>
        ) : (
          messages.map((m) => <Bubble key={m._id} message={m} />)
        )}
      </div>

      <div className="border-t border-border p-4">
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your reply…"
          className="w-full rounded-xl border border-border bg-surface-muted/40 p-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-fg-subtle">
            We&apos;re a small team and reply during business hours.
          </span>
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.fromRole === "customer";
  return (
    <div
      className={[
        "flex w-full",
        mine ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6",
          mine
            ? "bg-violet-600 text-white shadow-[0_18px_48px_-18px_rgba(99,102,241,0.5)]"
            : "bg-surface-muted text-fg",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={[
            "mt-1 text-[10px] uppercase tracking-[0.18em]",
            mine ? "text-white/75" : "text-fg-subtle",
          ].join(" ")}
        >
          {mine ? "You" : "DisputeIQ"} · {formatRelative(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function NewThreadComposer({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (subject: string, body: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onSend(subject.trim(), body.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">
          Start a conversation
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Describe what you need help with. The DisputeIQ team will get back
          to you with answers.
        </p>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        type="text"
        placeholder="Subject (optional) — e.g., 'Trouble connecting MyScoreIQ'"
        className="w-full rounded-xl border border-border bg-surface-muted/40 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
      />
      <textarea
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What's happening?"
        className="w-full rounded-xl border border-border bg-surface-muted/40 p-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send to support"}
        </button>
      </div>
    </div>
  );
}

function EmptyList({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-semibold text-fg">No messages yet</p>
      <p className="mt-1 text-[12px] leading-5 text-fg-muted">
        We&apos;ll reach out if anything needs your attention — or you can
        start a conversation.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:opacity-90"
      >
        Start a conversation
      </button>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-[68vh] min-h-[420px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
          <path
            d="M5 5h14v10h-9l-5 4V5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-fg">
        Pick a conversation
      </h2>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">
        Choose a thread on the left to read it, or start a new one — your
        history is saved here for reference.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90"
      >
        Start a conversation
      </button>
      <p className="mt-6 text-[11px] text-fg-subtle">
        Looking for the dashboard?{" "}
        <Link href="/dashboard" className="underline hover:text-fg">
          Go back
        </Link>
        .
      </p>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1 p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-surface-muted/70"
        />
      ))}
    </div>
  );
}

function formatRelative(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(ms).toLocaleDateString();
}

function formatDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

