import { PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy — DisputeIQ" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-fg">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-fg/60">Version {PRIVACY_VERSION}</p>

      <div className="prose prose-neutral mt-10 max-w-none">
        <h2>Data we collect</h2>
        <p>
          Account information (email, name, address) required to generate dispute letters;
          uploaded credit reports and the tradelines parsed from them; payment references (never
          card numbers — processed by Square); audit logs of platform actions.
        </p>

        <h2>How we use it</h2>
        <p>
          Solely to analyze your credit report, draft dispute letters, send certified mail, and
          track the lifecycle of each dispute. We never sell your data.
        </p>

        <h2>Security</h2>
        <p>
          Sensitive profile fields are encrypted at rest. Transport uses TLS. Dispute letters are
          stored in private secure storage and are never downloadable by users or exposed to the
          public internet.
        </p>

        <h2>Third parties</h2>
        <p>
          Square (payments), LetterStream (certified mail), Anthropic (AI drafting). Each handles
          only the minimum data required for its role.
        </p>

        <h2>Your rights</h2>
        <p>
          You may request export or deletion of your account data at any time by emailing{" "}
          <a href="mailto:privacy@disputeiq.com">privacy@disputeiq.com</a>.
        </p>
      </div>
    </article>
  );
}
