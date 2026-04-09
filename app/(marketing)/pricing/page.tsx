import Link from "next/link";
import { PACKET_PRICE_CENTS } from "@/lib/pricing";
import { URLS } from "@/lib/urls";

export const metadata = {
  title: "Pricing — DisputeIQ",
  description:
    "Flat $12.95 per dispute packet. One bureau, unlimited disputed items per packet, certified mail included. No subscriptions.",
};

const dollars = (PACKET_PRICE_CENTS / 100).toFixed(2);

export default function PricingPage() {
  return (
    <div className="bg-[#f7f5ee]">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="font-serif text-5xl text-[#0a0f1c] md:text-6xl">
          Pay for action. Not promises.
        </h1>
        <p className="mt-4 text-lg text-[#0a0f1c]/65">
          You only pay when disputes are actually sent — by certified mail, with delivery tracking.
        </p>

        <div className="mx-auto mt-12 max-w-2xl rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white shadow-[0_30px_80px_-30px_rgba(99,102,241,0.6)]">
          <h2 className="text-3xl font-bold">Dispute Action</h2>
          <p className="mt-2 text-lg text-white/80">Covers ALL disputes sent to ONE bureau</p>

          <div className="mt-6 text-6xl font-bold">${dollars}</div>
          <p className="mt-1 text-xs uppercase tracking-widest text-white/60">
            per packet · per bureau
          </p>

          <ul className="mt-8 space-y-3 text-left text-sm">
            <li className="flex gap-3">
              <span>✔</span>
              <span>Unlimited disputes inside one packet to that bureau</span>
            </li>
            <li className="flex gap-3">
              <span>✔</span>
              <span>USPS Certified Mail with electronic return receipt</span>
            </li>
            <li className="flex gap-3">
              <span>✔</span>
              <span>AI-drafted, FCRA-grounded dispute letter</span>
            </li>
            <li className="flex gap-3">
              <span>✔</span>
              <span>Delivery confirmation, tracking, and signature on record</span>
            </li>
            <li className="flex gap-3">
              <span>✔</span>
              <span>Full audit trail for every action</span>
            </li>
          </ul>

          <Link
            href={`${URLS.app}/dashboard/reports`}
            className="mt-8 inline-block rounded-xl bg-white px-8 py-3 text-sm font-semibold text-[#0a0f1c] hover:scale-[1.02]"
          >
            Start now →
          </Link>
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[#0a0f1c]/10 bg-white p-6 text-left text-sm text-[#0a0f1c]/80">
          <p className="font-semibold text-[#0a0f1c]">How packet pricing works</p>
          <p className="mt-2">
            We bundle every disputed item to a single bureau into one certified packet. If you
            select 40 disputes split across all three bureaus, that's{" "}
            <strong>3 packets — ${(3 * (PACKET_PRICE_CENTS / 100)).toFixed(2)}</strong>. Never per
            account, never per letter.
          </p>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-[11px] leading-relaxed text-[#0a0f1c]/50">
          DisputeIQ does not guarantee any specific credit score change, item removal, or financial
          outcome. Results vary by case. We do not provide legal or financial advice. We operate
          under your existing rights as a consumer under the Fair Credit Reporting Act (FCRA, 15
          U.S.C. §1681 et seq.).
        </p>
      </div>
    </div>
  );
}
