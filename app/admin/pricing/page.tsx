import { requireRole } from "@/lib/auth";
import { PLAN_LIST, CREDIT_MONITORING, formatCents } from "@/lib/billing/plans";
import { PACKET_DEFINITION } from "@/lib/billing/packet-definition";
import { DISCLOSURES } from "@/lib/billing/disclosures";

export default async function AdminPricingPage() {
  await requireRole(["OWNER", "ADMIN"]);

  // Estimated mailing cost per packet (LetterStream certified + ERR)
  const ESTIMATED_MAILING_COST_CENTS = 834;
  const PAYMENT_PROCESSING_PCT = 2.9;
  const PAYMENT_PROCESSING_FIXED_CENTS = 30;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing administration</h1>
        <p className="text-sm text-fg-muted">
          Source of truth: <code className="rounded bg-surface-muted px-1">lib/billing/plans.ts</code>.
          All public pricing, checkout, and API calculations read from that file.
        </p>
      </header>

      {/* Plan table */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-border-strong">
        <h2 className="text-lg font-semibold">Active plans</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="py-2 text-left">Plan</th>
              <th className="py-2 text-right">Monthly</th>
              <th className="py-2 text-right">Included packets</th>
              <th className="py-2 text-right">Overage/packet</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIST.map((p) => (
              <tr key={p.code} className="border-t border-border">
                <td className="py-3 font-semibold">{p.name}</td>
                <td className="py-3 text-right">{formatCents(p.monthlyPriceCents)}</td>
                <td className="py-3 text-right">{p.includedPackets}</td>
                <td className="py-3 text-right">{formatCents(p.overagePacketPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Credit monitoring */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-border-strong">
        <h2 className="text-lg font-semibold">Credit monitoring (separate billing)</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-fg-muted">Provider</dt>
            <dd className="font-semibold">{CREDIT_MONITORING.provider}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Customer price</dt>
            <dd className="font-semibold">{formatCents(CREDIT_MONITORING.monthlyPriceCents)}/mo</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Your commission</dt>
            <dd className="font-semibold">{formatCents(CREDIT_MONITORING.affiliateCommissionCents)}/mo</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Billed separately</dt>
            <dd className="font-semibold">Yes</dd>
          </div>
        </dl>
      </section>

      {/* Margin calculator */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-border-strong">
        <h2 className="text-lg font-semibold">Gross margin estimate (per customer/month)</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="py-2 text-left">Plan</th>
              <th className="py-2 text-right">Revenue</th>
              <th className="py-2 text-right">Est. mailing</th>
              <th className="py-2 text-right">Processing</th>
              <th className="py-2 text-right">MFSIQ comm.</th>
              <th className="py-2 text-right font-semibold">Gross margin</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIST.map((p) => {
              const revenue = p.monthlyPriceCents;
              const mailing = ESTIMATED_MAILING_COST_CENTS * p.includedPackets;
              const processing = Math.round(revenue * (PAYMENT_PROCESSING_PCT / 100)) + PAYMENT_PROCESSING_FIXED_CENTS;
              const commission = CREDIT_MONITORING.affiliateCommissionCents;
              const margin = revenue - mailing - processing + commission;
              return (
                <tr key={p.code} className="border-t border-border">
                  <td className="py-3 font-semibold">{p.name}</td>
                  <td className="py-3 text-right">{formatCents(revenue)}</td>
                  <td className="py-3 text-right text-rose-600">-{formatCents(mailing)}</td>
                  <td className="py-3 text-right text-rose-600">-{formatCents(processing)}</td>
                  <td className="py-3 text-right text-emerald-600">+{formatCents(commission)}</td>
                  <td className="py-3 text-right font-semibold">{formatCents(margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-4 text-[10px] text-fg-muted">
          Estimates assume {formatCents(ESTIMATED_MAILING_COST_CENTS)} mailing cost per packet (LetterStream certified + ERR),
          {" "}{PAYMENT_PROCESSING_PCT}% + {formatCents(PAYMENT_PROCESSING_FIXED_CENTS)} payment processing. Real costs may vary.
        </p>
      </section>

      {/* Disclosures in use */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-border-strong">
        <h2 className="text-lg font-semibold">Active disclosure copy</h2>
        <div className="mt-4 space-y-3 text-xs text-fg-muted">
          <div>
            <span className="font-semibold text-fg-muted">Software:</span> {DISCLOSURES.software}
          </div>
          <div>
            <span className="font-semibold text-fg-muted">Separate billing:</span> {DISCLOSURES.separateBilling}
          </div>
          <div>
            <span className="font-semibold text-fg-muted">Packet:</span> {DISCLOSURES.packet}
          </div>
          <div>
            <span className="font-semibold text-fg-muted">Outcome:</span> {DISCLOSURES.outcome}
          </div>
          <div>
            <span className="font-semibold text-fg-muted">Plan footer:</span> {DISCLOSURES.planFooter}
          </div>
        </div>
      </section>

      {/* Packet definition */}
      <section className="rounded-2xl bg-surface p-6 ring-1 ring-border-strong">
        <h2 className="text-lg font-semibold">Packet definition (public-facing)</h2>
        <p className="mt-2 text-sm text-fg-muted">{PACKET_DEFINITION.publicDescription}</p>
        <p className="mt-2 text-[10px] text-fg-muted">{PACKET_DEFINITION.legalNote}</p>
      </section>
    </div>
  );
}
