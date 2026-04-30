"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toast";
import type { BillingOverrideType } from "./types";

// Modal for setting an app-layer billing override on a customer.
// Restricted to OWNER/ADMIN at the API gate; we still show it to
// SUPPORT and let the API return 403 — UI doesn't try to predict role
// because the customer-360 page doesn't know the caller's role today.

export function BillingOverrideModal({
  customerId,
  initialType,
  initialValue,
  initialReason,
  onClose,
  onSaved,
}: {
  customerId: string;
  initialType?: BillingOverrideType | null;
  initialValue?: number | null;
  initialReason?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [type, setType] = useState<BillingOverrideType>(
    initialType ?? "free",
  );
  const [value, setValue] = useState<string>(
    typeof initialValue === "number" ? String(initialValue) : "",
  );
  const [reason, setReason] = useState<string>(initialReason ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      push("error", "Reason required", "Note why you're applying this override.");
      return;
    }
    let parsedValue: number | undefined;
    if (type === "discounted") {
      parsedValue = parseFloat(value);
      if (
        !Number.isFinite(parsedValue) ||
        parsedValue <= 0 ||
        parsedValue > 100
      ) {
        push("error", "Discount must be 1–100%");
        return;
      }
    } else if (type === "custom") {
      parsedValue = parseInt(value, 10);
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        push("error", "Custom amount must be a non-negative number (cents)");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/billing-override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            value: parsedValue,
            reason: trimmedReason,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };
      if (!data.ok) {
        push(
          "error",
          data.code === "FORBIDDEN"
            ? "Owner / admin only"
            : "Couldn't apply override",
          data.message ?? undefined,
        );
        return;
      }
      push("success", "Override applied");
      onSaved();
      onClose();
    } catch (err) {
      push("error", "Couldn't apply override", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apply billing override"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-[0_40px_100px_-30px_rgba(15,23,42,0.7)]">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
                Billing override
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                Comp, discount, or set a custom rate
              </h3>
              <p className="mt-1 text-sm text-white/85">
                Stripe still bills as configured. This override controls
                the customer-facing UX and the audit log.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full bg-white/15 p-1.5 text-white/90 ring-1 ring-white/30 hover:bg-white/25"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5 sm:px-8 sm:py-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
              Type
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["free", "discounted", "custom"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    "rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize",
                    type === t
                      ? "border-fg/30 bg-fg text-canvas"
                      : "border-border bg-surface text-fg-muted hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {t === "free" ? "Free" : t === "discounted" ? "% Off" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {type !== "free" && (
            <div>
              <label
                htmlFor="value"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle"
              >
                {type === "discounted"
                  ? "Discount percent (1–100)"
                  : "Custom amount (cents per cycle)"}
              </label>
              <input
                id="value"
                type="number"
                inputMode="numeric"
                min={type === "discounted" ? 1 : 0}
                max={type === "discounted" ? 100 : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "discounted" ? "20" : "4900"}
                className="mt-1 w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-sm text-fg focus:border-fg/30 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="reason"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle"
            >
              Reason (audit log)
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Lifetime VIP customer, comping for the next 90 days."
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted/40 p-3 text-sm text-fg focus:border-fg/30 focus:outline-none"
            />
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            This override only changes DisputeIQ&apos;s in-app behavior.
            To pause or cancel actual Stripe billing, use the Stripe
            Dashboard from the customer&apos;s record below.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Apply override"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
