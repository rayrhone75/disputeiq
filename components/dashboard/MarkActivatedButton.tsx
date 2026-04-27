"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Button shown next to "Activate MyScoreIQ" for users who already
 * completed activation elsewhere. Records an IDIQ_CLICK audit event
 * (legacy enum name; same signal the outbound CTA fires) so the status
 * chip advances to "In Progress", then refreshes the page and scrolls
 * them to the Connect Report panel.
 */
export function MarkActivatedButton({
  label = "I already activated MyScoreIQ",
  className = "",
  scrollTo = "#connect-panel",
}: {
  label?: string;
  className?: string;
  scrollTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function click() {
    setBusy(true);
    try {
      await fetch("/api/idiq/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "mark-activated" }),
        keepalive: true,
      });
    } catch {
      // non-blocking — we still advance the UI
    } finally {
      if (typeof window !== "undefined") {
        const el = document.querySelector(scrollTo);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className={
        className ||
        "rounded-2xl border border-border-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-fg hover:bg-surface-muted disabled:opacity-50"
      }
    >
      {busy ? "Marking…" : label}
    </button>
  );
}
