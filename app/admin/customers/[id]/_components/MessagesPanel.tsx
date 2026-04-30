"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./toast";

// Admin Messaging Panel inside Customer 360.
//
// Renders a thread list for a single customer + an inline detail view
// with composer + Mark resolved / Escalate buttons. Shares the same
// /api/messages/* endpoints the customer uses; access is enforced at
// the Convex layer (admin role bypasses the customer-ownership check).

type Thread = {
  _id: string;
  customerId: string;
  subject?: string | null;
  status: "open" | "resolved";
  resolvedAt?: number | null;
  escalated?: boolean | null;
  lastMessageAt: number;
  lastMessageFrom: "customer" | "admin";
  unreadForAdmin: boolean;
  unreadForCustomer: boolean;
  createdAt: number;
};

type Message = {
  _id: string;
  threadId: string;
  fromUserId: string;
  fromRole: "customer" | "admin";
  body: string;
  createdAt: number;
};

export function MessagesPanel({
  customerId,
  initialThreads,
  onChange,
}: {
  customerId: string;
  initialThreads: Thread[];
  onChange: () => void;
}) {
  const { push } = useToast();
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreads.find((t) => t.status === "open")?._id ?? null,
  );
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composing, setComposing] = useState(initialThreads.length === 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with parent when payload refreshes.
  useEffect(() => {
    setThreads(initialThreads);
  }, [initialThreads]);

  const visible = threads.filter((t) =>
    tab === "open" ? t.status === "open" : t.status === "resolved",
  );

  // Default-select when switching tabs.
  useEffect(() => {
    if (selectedId && visible.find((t) => t._id === selectedId)) return;
    setSelectedId(visible[0]?._id ?? null);
  }, [tab, visible, selectedId]);

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
      };
      if (data.ok && data.thread) {
        setThread(data.thread);
        setMessages(data.messages ?? []);
        // Mark the admin-side as read.
        await fetch(
          `/api/messages/threads/${encodeURIComponent(threadId)}/read`,
          { method: "POST" },
        ).catch(() => null);
        // Tell the parent so its payload refreshes (header pill updates).
        onChange();
      }
    } catch {
      // ignore — toast on next action if user notices.
    }
  }, [onChange]);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function refreshThreads() {
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/threads`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        threads?: Thread[];
      };
      if (data.ok && Array.isArray(data.threads)) {
        setThreads(data.threads);
      }
    } catch {
      // ignore
    }
  }

  async function sendReply(body: string) {
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
    await Promise.all([loadThread(selectedId), refreshThreads()]);
  }

  async function startThread(subject: string, body: string) {
    const res = await fetch("/api/messages/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        subject: subject.trim() || undefined,
        body,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      threadId?: string;
      message?: string;
    };
    if (!data.ok || !data.threadId) {
      push("error", "Couldn't send", data.message ?? undefined);
      return;
    }
    push("success", "Message sent");
    setComposing(false);
    await refreshThreads();
    setSelectedId(data.threadId);
  }

  async function setResolved(resolved: boolean) {
    if (!selectedId) return;
    const res = await fetch(
      `/api/messages/threads/${encodeURIComponent(selectedId)}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
    };
    if (!data.ok) {
      push("error", "Couldn't update", data.message ?? undefined);
      return;
    }
    push("success", resolved ? "Marked resolved" : "Reopened");
    await Promise.all([loadThread(selectedId), refreshThreads()]);
  }

  async function setEscalated(escalated: boolean) {
    if (!selectedId) return;
    const res = await fetch(
      `/api/messages/threads/${encodeURIComponent(selectedId)}/escalate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalated }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
    };
    if (!data.ok) {
      push("error", "Couldn't update", data.message ?? undefined);
      return;
    }
    push("success", escalated ? "Escalated" : "De-escalated");
    await Promise.all([loadThread(selectedId), refreshThreads()]);
  }

  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
            Messaging
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-fg sm:text-lg">
            Conversations with this customer
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Tabs tab={tab} onChange={setTab} threads={threads} />
          <button
            type="button"
            onClick={() => {
              setComposing(true);
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-fg px-3.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90"
          >
            New thread
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Thread list */}
        <ul
          className={[
            "max-h-[420px] space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface-muted/40 p-1.5",
            selectedId !== null || composing ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {visible.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-3 text-center text-[12px] text-fg-muted">
              {tab === "open"
                ? "No open conversations."
                : "No resolved conversations yet."}
            </li>
          ) : (
            visible.map((t) => (
              <li key={t._id}>
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setSelectedId(t._id);
                  }}
                  className={[
                    "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
                    t._id === selectedId
                      ? "bg-surface ring-1 ring-fg/15"
                      : "hover:bg-surface",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      t.unreadForAdmin ? "bg-violet-500" : "bg-fg-subtle/30",
                    ].join(" ")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-fg">
                        {t.subject || "Conversation"}
                      </span>
                      <span className="shrink-0 text-[10px] text-fg-subtle">
                        {formatRelative(t.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-fg-muted">
                      {t.escalated && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          ⚠ esc
                        </span>
                      )}
                      <span>
                        {t.lastMessageFrom === "customer"
                          ? "Customer wrote"
                          : "You replied"}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        {/* Detail / composer */}
        <div
          className={[
            "rounded-2xl border border-border bg-surface",
            selectedId === null && !composing ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          {composing ? (
            <NewThreadForm
              onCancel={() => {
                setComposing(false);
                setSelectedId(visible[0]?._id ?? null);
              }}
              onSend={startThread}
            />
          ) : thread ? (
            <ThreadDetail
              thread={thread}
              messages={messages}
              scrollRef={scrollRef}
              onSend={sendReply}
              onResolve={setResolved}
              onEscalate={setEscalated}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <EmptyDetail
              onNew={() => {
                setComposing(true);
                setSelectedId(null);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Tabs({
  tab,
  onChange,
  threads,
}: {
  tab: "open" | "resolved";
  onChange: (t: "open" | "resolved") => void;
  threads: Thread[];
}) {
  const openCount = threads.filter((t) => t.status === "open").length;
  const resolvedCount = threads.filter((t) => t.status === "resolved").length;
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface-muted/40 p-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
      {(["open", "resolved"] as const).map((t) => {
        const active = t === tab;
        const count = t === "open" ? openCount : resolvedCount;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={[
              "rounded-lg px-2.5 py-1 transition",
              active
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-muted hover:text-fg",
            ].join(" ")}
          >
            {t}
            <span className="ml-1.5 text-[10px] text-fg-subtle">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function NewThreadForm({
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
      await onSend(subject, body);
      setBody("");
      setSubject("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
          New conversation
        </p>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Send a message to this customer. They&apos;ll see it the next time
          they open the dashboard.
        </p>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (optional)"
        className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
      />
      <textarea
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message…"
        className="w-full rounded-xl border border-border bg-surface-muted/40 p-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border-strong bg-surface px-3.5 py-1.5 text-[11px] font-semibold text-fg hover:bg-surface-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          className="rounded-xl bg-fg px-3.5 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  messages,
  scrollRef,
  onSend,
  onResolve,
  onEscalate,
  onBack,
}: {
  thread: Thread;
  messages: Message[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSend: (body: string) => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
  onEscalate: (escalated: boolean) => Promise<void>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
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
    <div className="flex h-[420px] flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-muted hover:text-fg lg:hidden"
          >
            ← Back
          </button>
          <p className="truncate text-sm font-semibold text-fg">
            {thread.subject || "Conversation"}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Started {formatDateTime(thread.createdAt)} · {messages.length}{" "}
            message{messages.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEscalate(!thread.escalated)}
            className={[
              "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
              thread.escalated
                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                : "bg-surface-muted text-fg-muted hover:bg-amber-50 hover:text-amber-700",
            ].join(" ")}
          >
            {thread.escalated ? "De-escalate" : "Escalate"}
          </button>
          <button
            type="button"
            onClick={() => onResolve(thread.status !== "resolved")}
            className={[
              "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
              thread.status === "resolved"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "bg-surface-muted text-fg-muted hover:bg-emerald-50 hover:text-emerald-700",
            ].join(" ")}
          >
            {thread.status === "resolved" ? "Reopen" : "Mark resolved"}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-center text-[12px] text-fg-muted">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => <Bubble key={m._id} message={m} />)
        )}
      </div>

      <div className="border-t border-border p-3">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply to this customer…"
          className="w-full rounded-xl border border-border bg-surface-muted/40 p-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/30 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="rounded-xl bg-fg px-3 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const fromAdmin = message.fromRole === "admin";
  return (
    <div
      className={[
        "flex w-full",
        fromAdmin ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-5",
          fromAdmin
            ? "bg-violet-600 text-white"
            : "bg-surface-muted text-fg",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={[
            "mt-1 text-[9px] uppercase tracking-[0.18em]",
            fromAdmin ? "text-white/75" : "text-fg-subtle",
          ].join(" ")}
        >
          {fromAdmin ? "You" : "Customer"} · {formatRelative(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function EmptyDetail({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold text-fg">
        No thread selected
      </p>
      <p className="mt-1 max-w-[24ch] text-[12px] text-fg-muted">
        Click a thread on the left or start a new conversation with this
        customer.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-3 rounded-xl bg-fg px-3 py-1.5 text-[11px] font-semibold text-canvas hover:opacity-90"
      >
        Start new thread
      </button>
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
