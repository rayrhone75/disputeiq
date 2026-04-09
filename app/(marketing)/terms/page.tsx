import { TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of Service — DisputeIQ" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-[#0a0f1c]">
      <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-[#0a0f1c]/60">Version {TERMS_VERSION}</p>

      <div className="prose prose-neutral mt-10 max-w-none">
        <h2>1. Service Description</h2>
        <p>
          DisputeIQ provides a software platform that helps users analyze credit reports and
          generate dispute communications to credit bureaus and creditors. We do NOT guarantee
          credit score improvements, removal of any account, or specific outcomes. Results depend
          on credit bureaus and data furnishers.
        </p>

        <h2>2. Nature of Service</h2>
        <p>
          You understand and agree: DisputeIQ is a software platform, not a law firm. We do not
          provide legal advice. We do not act as a credit repair organization guaranteeing
          results.
        </p>

        <h2>3. Payment Terms</h2>
        <p>
          Pricing is per dispute packet (per bureau). Each payment is a one-time action fee. Once
          a dispute packet is submitted for mailing, the service is considered delivered. Payments
          are processed by Square.
        </p>

        <h2>4. No Refund Policy</h2>
        <p>
          Due to the nature of the service, payments are non-refundable once a dispute is
          submitted. Work begins immediately after payment. Certified mail is processed through
          third-party providers.
        </p>

        <h2>5. User Authorization</h2>
        <p>
          By using DisputeIQ, you authorize us to generate dispute letters based on your data and
          send those letters on your behalf via certified mail.
        </p>

        <h2>6. No Guarantees</h2>
        <p>
          We do not guarantee deletion of accounts, changes to credit reports, or timelines for
          results.
        </p>

        <h2>7. User Responsibilities</h2>
        <p>
          You agree to provide accurate information, review dispute selections before submission,
          and not misuse the platform.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          DisputeIQ is not liable for credit bureau decisions, delays in mail delivery, or
          third-party system issues.
        </p>

        <h2>9. Modifications</h2>
        <p>We may update these terms at any time.</p>

        <h2>10. Contact</h2>
        <p>support@disputeiq.com</p>
      </div>
    </article>
  );
}
