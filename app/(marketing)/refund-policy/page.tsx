import { REFUND_POLICY_VERSION } from "@/lib/legal";

export const metadata = { title: "Refund Policy — DisputeIQ" };

export default function RefundPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-fg">
      <h1 className="text-4xl font-semibold tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-sm text-fg/60">Version {REFUND_POLICY_VERSION}</p>

      <div className="prose prose-neutral mt-10 max-w-none">
        <p>
          All purchases are <strong>final once a dispute packet is submitted</strong>.
        </p>
        <p>Why:</p>
        <ul>
          <li>Work begins immediately.</li>
          <li>Letters are generated and mailed through a third-party certified mail provider.</li>
          <li>Third-party mailing costs are incurred as soon as the packet is dispatched.</li>
        </ul>
        <p>We do not guarantee outcomes.</p>
        <p>
          If a technical error occurs <em>before</em> submission — for example, the certified mail
          handoff fails — contact support at <a href="mailto:support@disputeiq.com">support@disputeiq.com</a>.
        </p>
        <p>By purchasing, you acknowledge and agree to this policy.</p>
      </div>
    </article>
  );
}
