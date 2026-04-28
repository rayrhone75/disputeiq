"use client";

import { useState } from "react";

export function LeadCaptureForm({
  source,
  topic,
  variant = "inline",
}: {
  source: string;
  topic?: string;
  variant?: "inline" | "stacked";
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: name, phone, source, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Submit failed");
      setDone(true);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
        Thanks — check your inbox. Want to start now?{" "}
        <a href="/get-started" className="font-semibold underline">
          Get your free credit report →
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        variant === "inline"
          ? "flex flex-col gap-2 sm:flex-row sm:items-center"
          : "flex flex-col gap-3"
      }
    >
      {/* suppressHydrationWarning on form controls swallows extension-injected
          attributes like Edge's `fdprocessedid` that mangle inputs before
          React hydrates. Form behavior is unchanged. */}
      <input
        required
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="flex-1 rounded-lg border border-fg/15 bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        suppressHydrationWarning
      />
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className="flex-1 rounded-lg border border-fg/15 bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        suppressHydrationWarning
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        className="flex-1 rounded-lg border border-fg/15 bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        suppressHydrationWarning
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        suppressHydrationWarning
      >
        {busy ? "Sending…" : "Get free preview"}
      </button>
      {err && <p className="text-xs text-rose-600 sm:basis-full">{err}</p>}
    </form>
  );
}
