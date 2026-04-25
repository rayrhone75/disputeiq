"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IdiqConfig } from "@/lib/integrations/identityiq";

export function IdiqSettingsForm({ initial }: { initial: IdiqConfig }) {
  const router = useRouter();
  const [affiliateUrl, setAffiliateUrl] = useState(initial.affiliateUrl);
  const [stageUrl, setStageUrl] = useState(initial.stageUrl ?? "");
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/settings/idiq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateUrl,
          stageUrl: stageUrl.trim() || null,
          displayName,
          instructions,
          disclaimer,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "SAVE_FAILED");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
  const labelCls = "space-y-1 text-sm";
  const labelTitle = "font-semibold text-fg-muted";

  return (
    <div className="space-y-5">
      <label className={labelCls}>
        <span className={labelTitle}>Affiliate URL</span>
        <input
          className={inputCls}
          value={affiliateUrl}
          onChange={(e) => setAffiliateUrl(e.target.value)}
          placeholder="https://www.identityiq.com/..."
        />
      </label>
      <label className={labelCls}>
        <span className={labelTitle}>Stage / test URL (optional)</span>
        <input
          className={inputCls}
          value={stageUrl}
          onChange={(e) => setStageUrl(e.target.value)}
          placeholder="https://stage.identityiq.com/..."
        />
      </label>
      <label className={labelCls}>
        <span className={labelTitle}>Display name</span>
        <input
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>
      <label className={labelCls}>
        <span className={labelTitle}>Onboarding instructions (one step per line)</span>
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={6}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>
      <label className={labelCls}>
        <span className={labelTitle}>Customer-facing disclaimer</span>
        <textarea
          className={`${inputCls} text-xs`}
          rows={4}
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Saved. Changes are live.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save IDIQ settings"}
      </button>
    </div>
  );
}
