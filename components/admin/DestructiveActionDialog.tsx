"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Variant = "caution" | "destructive" | "purge";

/**
 * Unified confirmation dialog for admin-initiated deletions.
 *
 * Props:
 *   previewUrl     — GET endpoint returning { rowsToRemove, expectedConfirmation }
 *   submitUrl      — POST endpoint that performs the delete
 *   expectedConfirmation — literal phrase the admin must type to enable Submit
 *   title, cta, onDone — UI text + post-success callback
 */
export function DestructiveActionDialog({
  title,
  description,
  previewUrl,
  submitUrl,
  expectedConfirmation,
  cta = "Delete",
  variant = "destructive",
  onDone,
}: {
  title: string;
  description: string;
  previewUrl?: string;
  submitUrl: string;
  expectedConfirmation: string;
  cta?: string;
  variant?: Variant;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [impact, setImpact] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function openDialog() {
    setOpen(true);
    setError(null);
    if (previewUrl) {
      setLoadingPreview(true);
      try {
        const res = await fetch(previewUrl);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? json.error ?? "PREVIEW_FAILED");
        setImpact(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingPreview(false);
      }
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirmation }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP_${res.status}`);
      setOpen(false);
      setReason("");
      setConfirmation("");
      onDone?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btnTone =
    variant === "purge"
      ? "bg-rose-800 text-white hover:bg-rose-900 ring-2 ring-rose-300"
      : variant === "destructive"
        ? "bg-rose-600 text-white hover:bg-rose-700"
        : "bg-amber-500 text-white hover:bg-amber-600";

  const confirmReady =
    confirmation.trim() === expectedConfirmation.trim() &&
    reason.trim().length >= 10 &&
    !busy;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold ${btnTone}`}
      >
        {cta}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-xl ${
              variant === "purge" ? "border-rose-400" : "border-ink-200"
            }`}
          >
            <header
              className={`border-b px-6 py-4 ${
                variant === "purge"
                  ? "border-rose-200 bg-rose-50"
                  : variant === "destructive"
                    ? "border-rose-100 bg-rose-50/60"
                    : "border-amber-100 bg-amber-50/60"
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  variant === "purge"
                    ? "text-rose-700"
                    : variant === "destructive"
                      ? "text-rose-600"
                      : "text-amber-600"
                }`}
              >
                {variant === "purge"
                  ? "Irreversible · OWNER only"
                  : variant === "destructive"
                    ? "Destructive action"
                    : "Caution"}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink-900">{title}</h2>
              <p className="mt-1 text-xs text-ink-600">{description}</p>
            </header>

            <div className="space-y-4 px-6 py-5 text-sm">
              {loadingPreview && <p className="text-xs text-ink-500">Loading impact…</p>}
              {impact && (
                <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                    Impact
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] text-ink-800">
                    {JSON.stringify(impact, null, 2)}
                  </pre>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-ink-700">Reason (min 10 chars)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                  placeholder="Why is this being deleted? (audit log)"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-ink-700">
                  Type to confirm:{" "}
                  <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-white">
                    {expectedConfirmation}
                  </code>
                </span>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-sm"
                />
              </label>
              {error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-6 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmReady}
                onClick={submit}
                className={`rounded-xl px-4 py-1.5 text-sm font-semibold disabled:opacity-40 ${btnTone}`}
              >
                {busy ? "Running…" : cta}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
