import { COMPLIANCE_NOTICE } from "@/lib/compliance";

export default function TrustCenter() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Trust Center</h1>
      <section className="mt-8 space-y-4 text-slate-700">
        <p>{COMPLIANCE_NOTICE}</p>
        <h2 className="text-xl font-semibold">Your rights</h2>
        <ul className="list-disc pl-5">
          <li>You may dispute inaccuracies on your credit report directly with the bureaus for free.</li>
          <li>You may request your annual free reports at annualcreditreport.com.</li>
          <li>You can revoke your consent and close your account at any time.</li>
        </ul>
        <h2 className="text-xl font-semibold">What we don't do</h2>
        <ul className="list-disc pl-5">
          <li>We do not guarantee removal of any item from your credit report.</li>
          <li>We do not guarantee any change in your credit score.</li>
          <li>We do not submit anything on your behalf without your explicit confirmation.</li>
        </ul>
      </section>
    </main>
  );
}
