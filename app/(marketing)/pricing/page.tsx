import Link from "next/link";
import { PLAN_LIST, formatCents, formatMonthly, CREDIT_MONITORING } from "@/lib/billing/plans";
import { PACKET_DEFINITION } from "@/lib/billing/packet-definition";
import { DISCLOSURES } from "@/lib/billing/disclosures";

export const metadata = {
  title: "Pricing — MyDIY Credit Repair",
  description:
    "Monthly software plans with included dispute packets. IdentityIQ billed separately at $24.95/month.",
};

const FAQ = [
  {
    q: "What is a packet?",
    a: PACKET_DEFINITION.publicDescription,
  },
  {
    q: "Am I charged per dispute item?",
    a: "No. Multiple disputed items are grouped into one packet submission round. You are charged per packet, not per tradeline.",
  },
  {
    q: "Why is IdentityIQ billed separately?",
    a: "IdentityIQ provides your 3-bureau credit report and monitoring. It is a separate service billed at $24.95/month directly by IdentityIQ, not by us.",
  },
  {
    q: "Do I need credit monitoring to use the platform?",
    a: "Yes. An active IdentityIQ membership is required so the platform can analyze your credit report data.",
  },
  {
    q: "What happens if I use all my included packets?",
    a: "Extra packets after your monthly included amount are $19.95 each. You'll see the charge clearly before confirming.",
  },
  {
    q: "Can one packet include multiple disputed accounts?",
    a: "Yes. A packet groups all your selected items for that dispute round. Multiple accounts, multiple reasons, multiple bureau letters — all in one packet.",
  },
  {
    q: "Are bureau letters included?",
    a: "Yes. The platform generates bureau-specific certified mail letters as part of each packet. The number of letters depends on which bureaus are involved.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-[#f7f5ee]">
      {/* Hero */}
      <div className="mx-auto max-w-5xl px-6 pt-20 text-center">
        <h1 className="font-serif text-4xl text-[#0a0f1c] md:text-5xl">
          Powerful DIY credit repair tools without confusing per-item pricing
        </h1>
        <p className="mt-4 text-lg text-[#0a0f1c]/65">
          Connect your required credit monitoring, choose your monthly plan, and send dispute
          packets with AI-powered guidance and built-in mailing.
        </p>
      </div>

      {/* Credit monitoring notice */}
      <div className="mx-auto mt-10 max-w-3xl px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
          <div className="font-semibold">Credit monitoring required</div>
          <p className="mt-1">
            This platform requires an active credit monitoring account through IdentityIQ at
            $24.95/month, billed separately. This charge is not included in your software
            subscription.
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 px-6 md:grid-cols-3">
        {PLAN_LIST.map((plan) => (
          <div
            key={plan.code}
            className={`flex flex-col rounded-3xl border p-8 shadow-sm ${
              plan.code === "pro"
                ? "border-indigo-300 bg-gradient-to-b from-indigo-50 to-white ring-2 ring-indigo-200"
                : "border-[#0a0f1c]/10 bg-white"
            }`}
          >
            {plan.code === "pro" && (
              <span className="mb-4 inline-block self-start rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                Most popular
              </span>
            )}
            <div className="text-3xl font-bold text-[#0a0f1c]">
              {formatMonthly(plan.monthlyPriceCents)}
            </div>
            <div className="mt-1 text-lg font-semibold text-[#0a0f1c]">{plan.name}</div>
            <p className="mt-2 text-sm text-[#0a0f1c]/70">{plan.tagline}</p>

            <ul className="mt-6 flex-1 space-y-2 text-sm text-[#0a0f1c]/80">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-indigo-600">✔</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 block rounded-xl bg-[#0a0f1c] py-3 text-center text-sm font-semibold text-white hover:bg-[#0a0f1c]/90"
            >
              Start with {plan.name}
            </Link>

            <p className="mt-4 text-[10px] leading-relaxed text-[#0a0f1c]/50">
              {DISCLOSURES.planFooter}
            </p>
          </div>
        ))}
      </div>

      {/* What is a packet */}
      <div className="mx-auto mt-20 max-w-3xl px-6">
        <div className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-8">
          <h2 className="text-xl font-semibold text-[#0a0f1c]">What counts as a packet?</h2>
          <p className="mt-3 text-sm text-[#0a0f1c]/80">
            A packet is one dispute submission round for the billing period.
          </p>
          <p className="mt-3 text-sm text-[#0a0f1c]/80">Each packet can include:</p>
          <ul className="mt-2 space-y-1 text-sm text-[#0a0f1c]/80">
            <li>• Multiple dispute items</li>
            <li>• Multiple accounts</li>
            <li>• Multiple reasons for challenge</li>
            <li>• Bureau-specific letters generated as needed</li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-[#0a0f1c]/80">
            You are not charged per item.
          </p>
          <p className="mt-1 text-sm text-[#0a0f1c]/70">
            If you challenge many items in one round, they are grouped into your packet submission
            for that cycle.
          </p>
          <p className="mt-4 text-[10px] text-[#0a0f1c]/50">{PACKET_DEFINITION.legalNote}</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-16 max-w-3xl px-6">
        <h2 className="text-2xl font-semibold text-[#0a0f1c]">Frequently asked questions</h2>
        <div className="mt-6 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="text-base font-semibold text-[#0a0f1c]">{item.q}</h3>
              <p className="mt-2 text-sm text-[#0a0f1c]/75">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimers */}
      <div className="mx-auto mt-16 max-w-3xl space-y-3 px-6 pb-20 text-[11px] leading-relaxed text-[#0a0f1c]/50">
        <p>{DISCLOSURES.software}</p>
        <p>{DISCLOSURES.separateBilling}</p>
        <p>{DISCLOSURES.packet}</p>
        <p>{DISCLOSURES.outcome}</p>
      </div>
    </div>
  );
}
