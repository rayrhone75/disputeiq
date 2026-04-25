"use client";

import { useState } from "react";

const KINDS: { value: string; label: string; placeholder: string }[] = [
  { value: "instagram", label: "Instagram caption", placeholder: "Topic: how DisputeIQ analyzes a credit report in under a minute" },
  { value: "tiktok", label: "TikTok hooks", placeholder: "Topic: removing collections" },
  { value: "facebook", label: "Facebook post", placeholder: "Topic: difference between charge-offs and collections" },
  { value: "twitter_thread", label: "Twitter / X thread", placeholder: "Topic: 5 dispute mistakes that kill your case" },
  { value: "comment_reply", label: "Comment reply", placeholder: "Paste the comment you want to reply to" },
  { value: "dm_reply", label: "Inbound DM reply", placeholder: "Paste the DM you received" },
  { value: "campaign_7day", label: "7-day campaign", placeholder: "Audience + theme" },
  { value: "viral_hooks", label: "Viral hooks", placeholder: "Topic angle" },
];

export function GrowthConsole() {
  const [kind, setKind] = useState(KINDS[0].value);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState<boolean | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    setOutput("");
    try {
      const res = await fetch("/api/admin/growth/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setOutput(data.output);
      setLive(data.live);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const placeholder = KINDS.find((k) => k.value === kind)?.placeholder ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-border-strong">
        <label className="block text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Generator
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          rows={8}
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm"
        />
        <button
          onClick={generate}
          disabled={busy || !prompt.trim()}
          className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-canvas disabled:opacity-50 hover:bg-fg/90"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>

      <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-border-strong">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Output</label>
          {live === false && (
            <span className="text-[10px] uppercase tracking-wide text-amber-600">offline AI fallback</span>
          )}
          {live === true && (
            <span className="text-[10px] uppercase tracking-wide text-emerald-600">live · claude-opus</span>
          )}
        </div>
        <pre className="min-h-[300px] whitespace-pre-wrap rounded-lg bg-surface-muted p-4 text-xs text-fg">
          {output || "Generated content will appear here."}
        </pre>
        {output && (
          <button
            onClick={() => navigator.clipboard.writeText(output)}
            className="rounded-lg bg-surface px-3 py-1.5 text-xs ring-1 ring-border-strong hover:bg-surface-muted/60"
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}
