import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";
import { MYFREESCORENOW } from "@/lib/integrations/myfreescorenow";

export const metadata = {
  title: "Disclosures — DisputeIQ",
  description:
    "Full disclosures for DisputeIQ, our Screwed Up Credit ecosystem, and MyFreeScoreNow intake partner.",
};

const blocks = [
  {
    k: "Compliance",
    t: "What DisputeIQ is — and isn't.",
    body: [
      COMPLIANCE_NOTICE,
      "DisputeIQ is a software and workflow tool. It helps you review your credit reports, identify potential inaccuracies, prepare dispute documents, and track certified mailings. It is not a credit repair organization, a law firm, or a financial advisor.",
      "Nothing leaves the platform without your explicit confirmation. There is no auto-dispatch and no hidden action.",
    ],
  },
  {
    k: "No guarantees",
    t: "We do not promise outcomes.",
    body: [
      "We do not guarantee removal of any item from your credit report.",
      "We do not guarantee any change in your credit score.",
      "Anyone who promises guaranteed credit results is making a claim that cannot be supported. DisputeIQ optimizes for accuracy and documentation, not promises.",
    ],
  },
  {
    k: "Your rights",
    t: "What you can always do, for free.",
    body: [
      "You may dispute inaccuracies on your credit report yourself, for free, directly with the credit bureaus.",
      "You may request your annual free reports at annualcreditreport.com.",
      "You may revoke consent and close your account at any time.",
      "You may request export of all your data on demand.",
    ],
  },
  {
    k: "Ecosystem",
    t: "DisputeIQ and Screwed Up Credit.",
    body: [
      "DisputeIQ is operated within the Screwed Up Credit ecosystem. Screwed Up Credit is the parent ecosystem that connects DisputeIQ with ecosystem partner products.",
      `${MYFREESCORENOW.productName} is the 3-bureau report intake partner used by the Screwed Up Credit customer journey. When you enroll through MyFreeScoreNow from our website, you are beginning that journey.`,
      "DisputeIQ may receive a referral fee when you enroll through our intake partner. This does not change what you pay.",
    ],
  },
  {
    k: "Data",
    t: "How your file is handled.",
    body: [
      "DisputeIQ encrypts your data at rest with AES-256 and in transit with TLS 1.3. Credit reports and documents live in a per-tenant isolated vault.",
      "We do not sell, rent, or share your data with marketing partners. We do not use your file for training third-party AI models.",
      "Every action — uploads, drafts, dispatches, deletions — is written to an immutable audit log you can export on demand.",
    ],
  },
  {
    k: "Legal",
    t: "Legal basis and jurisdiction.",
    body: [
      "DisputeIQ operates in the United States. Users are responsible for complying with the laws of their state or territory.",
      "Section 611 of the FCRA provides the right to dispute inaccurate information. Section 605B provides the right to have information resulting from alleged identity theft blocked by a consumer reporting agency, subject to specific documentation requirements.",
      "DisputeIQ does not provide legal advice. If your situation requires legal counsel, consult a licensed attorney.",
    ],
  },
];

export default function DisclosuresPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[520px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.12),transparent)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Disclosures
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-[#0a0f1c] sm:text-[64px]">
            Full transparency,
            <br />
            <span className="italic">in plain language.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-[#4a4638]">
            What DisputeIQ is, what it isn't, and how the Screwed Up Credit ecosystem fits
            together.
          </p>
        </div>
      </section>

      {/* Blocks */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-20">
          <div className="space-y-5">
            {blocks.map((b) => (
              <article
                key={b.t}
                className="relative overflow-hidden rounded-[24px] border border-[#e8e4d8] bg-white p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_18px_36px_-24px_rgba(10,15,28,0.12)]"
              >
                <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-600">
                      {b.k}
                    </p>
                  </div>
                  <div>
                    <h2 className="font-serif text-[24px] leading-tight tracking-tight text-[#0a0f1c]">
                      {b.t}
                    </h2>
                    <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-[#3d3a2e]">
                      {b.body.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTAs */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-28">
          <div className="rounded-[24px] border border-[#e8e4d8] bg-[#faf9f4] p-10 text-center shadow-[0_1px_0_0_rgba(10,15,28,0.03)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a8472]">
              Questions?
            </p>
            <p className="mx-auto mt-4 max-w-xl font-serif text-[22px] leading-tight text-[#0a0f1c]">
              Email us at{" "}
              <a
                href="mailto:support@disputeiq.org"
                className="underline decoration-indigo-500 decoration-2 underline-offset-4"
              >
                support@disputeiq.org
              </a>{" "}
              and we will respond with full context.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/trust-center"
                className="inline-flex items-center gap-2 rounded-xl border border-[#0a0f1c] bg-[#0a0f1c] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#111827]"
              >
                Trust center →
              </Link>
              <Link
                href="/get-started"
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9d3c0] bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a0f1c] transition hover:border-[#0a0f1c]"
              >
                Start your file
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
