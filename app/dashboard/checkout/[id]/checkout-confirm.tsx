"use client";

import { useState } from "react";
import Link from "next/link";
import { CHECKOUT_CONSENT_ITEMS } from "@/lib/legal";

type ConsentState = Record<(typeof CHECKOUT_CONSENT_ITEMS)[number]["key"], boolean>;

export function CheckoutConfirm({
  disputeCaseId,
  creditor,
  reason,
  totalCents,
  isGrace,
}: {
  disputeCaseId: string;
  creditor: string;
  reason: string;
  totalCents: number;
  isGrace: boolean;
}) {
  const [consents, setConsents] = useState<ConsentState>({
    no_guarantee: false,
    authorization: false,
    non_refundable: false,
    bureau_dependent: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allAccepted = CHECKOUT_CONSENT_ITEMS.every((it) => consents[it.key]);
  const dollars = (totalCents / 100).toFixed(2);

  async function proceed() {
    if (!allAccepted) {
      setErr("Please accept every item before continuing.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // First, lock the dispute (confirm step)
      await fetch(`/api/disputes/${disputeCaseId}/confirm`, { method: "POST" }).catch(() => null);

      // Then create the Square checkout with the full consent payload
      const res = await fetch(`/api/payments/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeCaseId,
          disclosuresAccepted: true,
          affiliateDisclosureAccepted: true,
          userConfirmed: true,
          checkoutConsents: consents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Checkout failed");
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl bg-[#0b0f1a] p-8 text-white shadow-2xl">
      <h2 className="text-3xl font-bold">Review &amp; confirm your dispute</h2>
      <p className="mt-2 text-sm text-white/60">
        By proceeding, you confirm you reviewed your dispute selections and authorize DisputeIQ to act on your behalf.
      </p>

      <div className="mt-6 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
        <div className="text-xs uppercase tracking-wide text-white/50">Packet summary</div>
        <div className="mt-2 text-lg font-semibold">{creditor}</div>
        <div className="mt-1 text-sm text-white/70">{reason}</div>
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">Total</div>
            <div className="text-3xl font-bold">{isGrace ? "$0.00" : `$${dollars}`}</div>
            <div className="text-[11px] text-white/50">
              {isGrace ? "Grace account · fee waived" : "Flat packet price · per bureau"}
            </div>
          </div>
          <div className="text-right text-xs text-white/60">
            <div>1 certified mail packet</div>
            <div>USPS Certified + ERR</div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
          What happens next
        </div>
        <ol className="mt-3 space-y-2 text-sm text-white/80">
          <li>1. Square processes your payment.</li>
          <li>2. DisputeIQ submits the packet to LetterStream for certified mailing.</li>
          <li>3. You track delivery, signature, and bureau response in your dashboard.</li>
        </ol>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 text-sm">
        {CHECKOUT_CONSENT_ITEMS.map((it) => (
          <label key={it.key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consents[it.key]}
              onChange={(e) =>
                setConsents((prev) => ({ ...prev, [it.key]: e.target.checked }))
              }
              className="mt-1"
            />
            <span className="text-white/85">{it.text}</span>
          </label>
        ))}
        <p className="pt-2 text-[11px] text-white/50">
          By proceeding you accept the{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/refund-policy" className="underline">
            Refund Policy
          </Link>
          , and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          . Your consent is recorded with a timestamp, IP, and terms version.
        </p>
      </div>

      {err && <p className="mt-4 text-sm text-rose-400">{err}</p>}

      <button
        onClick={proceed}
        disabled={busy || !allAccepted}
        className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Redirecting to Square…" : "Confirm &amp; send dispute packet"}
      </button>
    </div>
  );
}
