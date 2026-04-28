"use client";

import { useState } from "react";

// POSTs to /api/subscriptions/portal and redirects the browser to the
// Stripe-hosted Customer Portal. Used by SubscriptionBanner (past_due) and
// any "Manage billing" / "Update payment method" CTA in the dashboard.
export function BillingPortalButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/subscriptions/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.message ?? data?.error ?? "Portal unavailable");
      }
      window.location.href = data.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
        }
      >
        {busy ? "Opening…" : (children ?? "Manage billing")}
      </button>
      {err && (
        <p className="mt-2 text-[11px] text-rose-700">
          {err}
        </p>
      )}
    </div>
  );
}
