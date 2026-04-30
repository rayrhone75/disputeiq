"use client";

import { useEffect, useState } from "react";

// Tiny client component: polls /api/messages/unread-count every 30s
// and renders a small numeric pill when there are unread messages.
// Used inside the AppShell sidebar (which is a server component).

export function MessagesNavBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/messages/unread-count", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          count?: number;
        };
        if (cancelled) return;
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // ignore; nav stays unmarked on transient failure
      }
    }
    void tick();
    const t = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (!count) return null;
  return (
    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(99,102,241,0.6)]">
      {count > 99 ? "99+" : count}
    </span>
  );
}
