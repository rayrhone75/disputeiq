"use client";

import Link from "next/link";

export function PacketMeter({
  planName,
  included,
  used,
  remaining,
  overageCents,
}: {
  planName: string | null;
  included: number;
  used: number;
  remaining: number;
  overageCents: number;
}) {
  if (!planName) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
        <h3 className="text-lg font-semibold text-amber-900">No active plan</h3>
        <p className="mt-2 text-sm text-amber-900/75">
          Choose a plan to unlock included dispute packets each month. Without a plan, each packet
          costs ${(overageCents / 100).toFixed(2)}.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
        >
          See plans →
        </Link>
      </section>
    );
  }

  const pct = included > 0 ? Math.round((used / included) * 100) : 0;

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{planName} plan</h3>
          <p className="text-xs text-ink-500">
            {used} of {included} packets used this cycle · {remaining} remaining
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-ink-900">{remaining}</div>
          <div className="text-[10px] uppercase tracking-wide text-ink-500">remaining</div>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {remaining === 0 && (
        <p className="mt-3 text-xs text-ink-600">
          Next packet will be charged as an overage at ${(overageCents / 100).toFixed(2)}.
        </p>
      )}
    </section>
  );
}
