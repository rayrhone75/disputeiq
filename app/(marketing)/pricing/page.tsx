import { getLetterPricing } from "@/lib/pricing";

export default function PricingPage() {
  const standard = getLetterPricing({ isGraceUser: false });
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-3 text-slate-600">Pay only when you take action. No long-term contracts.</p>
      <div className="mt-8 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">Letter action</h2>
        <p className="mt-2 text-slate-700">Software fee: ${(standard.softwareFee / 100).toFixed(2)}</p>
        <p className="text-slate-700">Certified mailing: ${(standard.mailingFee / 100).toFixed(2)}</p>
        <p className="mt-3 text-lg font-semibold">Total: ${(standard.total / 100).toFixed(2)}</p>
      </div>
    </main>
  );
}
