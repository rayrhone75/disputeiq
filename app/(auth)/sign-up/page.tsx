"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { DISCLOSURES } from "@/lib/billing/disclosures";

const HELPFUL_DOCS = [
  "Government-issued ID",
  "Proof of address",
  "Social Security card or verification (only if needed)",
  "Credit denial letters",
  "Collection letters",
  "Medical billing records (if relevant)",
  "Bankruptcy discharge paperwork (if relevant)",
  "Police report / identity theft affidavit (if relevant)",
  "Previous bureau responses",
  "Letters already sent to creditors or bureaus",
];

const NEXT_STEPS = [
  "Activate your IdentityIQ monitoring",
  "Connect or import your credit report",
  "Upload supporting documents",
  "Review your report summary",
  "Plan and start disputes",
  "Track progress from your dashboard",
];

export default function SignUpPage() {
  const [step, setStep] = useState<"disclosures" | "account">("disclosures");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Three disclosure checkboxes the user must accept before account creation.
  const [ackMonitoring, setAckMonitoring] = useState(false);
  const [ackBilling, setAckBilling] = useState(false);
  const [ackDiy, setAckDiy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allAccepted = ackMonitoring && ackBilling && ackDiy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAccepted) {
      setErr("Please accept all three disclosures to continue.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          disclosuresAccepted: true,
          affiliateDisclosureAccepted: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(
          data.error === "EMAIL_IN_USE"
            ? "An account with this email already exists."
            : "Could not create account.",
        );
        return;
      }
      await signIn("credentials", { email, password, redirect: false });
      // After signup, land the user on the guided IDIQ setup page.
      window.location.href = "/dashboard/get-report?welcome=1";
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Create your account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a0f1c] sm:text-4xl">
          Join DisputeIQ
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4a4638]">
          DisputeIQ is the DIY credit workflow platform for disciplined disputes, certified mail
          tracking, and escalation. Setup takes a few minutes and is fully guided.
        </p>
      </header>

      {/* ScrewedUpCredit migration banner */}
      <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800">
          Switching from ScrewedUpCredit?
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#0a0f1c]">
          Already a ScrewedUpCredit customer?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#3d3a2e]">
          If you previously used ScrewedUpCredit with MyFreeScoreIQ, you now need to switch to{" "}
          <span className="font-semibold text-[#0a0f1c]">IdentityIQ</span> for report access and
          monitoring inside DisputeIQ. Create your DisputeIQ account below, complete your
          IdentityIQ enrollment, and then return here to continue.
        </p>
        <p className="mt-2 text-xs text-[#3d3a2e]">
          Already have a DisputeIQ account?{" "}
          <Link href="/sign-in" className="font-semibold text-amber-800 underline">
            Sign in here
          </Link>
          .
        </p>
      </section>

      {step === "disclosures" && (
        <div className="space-y-6">
          {/* Disclosure bullets */}
          <section className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-5">
            <h3 className="text-sm font-semibold text-[#0a0f1c]">Before continuing, please note</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#3d3a2e]">
              <li>• DisputeIQ uses IdentityIQ for credit report access and monitoring.</li>
              <li>
                • If you are a former ScrewedUpCredit customer, you must switch to IdentityIQ to
                continue with the updated system.
              </li>
              <li>• IdentityIQ billing is separate from your DisputeIQ subscription.</li>
              <li>
                • Your DisputeIQ subscription covers dispute workflow, document organization,
                tracking, and automation tools.
              </li>
              <li>• Credit report access depends on an active IdentityIQ membership.</li>
              <li>
                • Results vary based on bureau responses, furnisher investigations, documentation,
                and report history.
              </li>
            </ul>
          </section>

          {/* Legal paragraph block */}
          <section className="rounded-2xl border border-[#0a0f1c]/10 bg-[#faf9f4] p-5 text-xs leading-relaxed text-[#3d3a2e]">
            <p>
              DisputeIQ is a DIY credit workflow platform that helps users organize, review,
              prepare, and track dispute activity. We do not guarantee any specific score
              increase or deletion outcome.
            </p>
            <p className="mt-3">
              IdentityIQ membership is required for report access and monitoring within the
              current DisputeIQ workflow. If you are switching from ScrewedUpCredit, complete your
              IdentityIQ setup first, then return to DisputeIQ to continue onboarding.
            </p>
            <p className="mt-3 text-[#6b6556]">{DISCLOSURES.outcome}</p>
          </section>

          {/* Checkboxes */}
          <section className="space-y-3">
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0a0f1c]/85">
              <input
                type="checkbox"
                checked={ackMonitoring}
                onChange={(e) => setAckMonitoring(e.target.checked)}
                className="mt-0.5"
              />
              I understand that IdentityIQ is required for report access and monitoring in
              DisputeIQ.
            </label>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0a0f1c]/85">
              <input
                type="checkbox"
                checked={ackBilling}
                onChange={(e) => setAckBilling(e.target.checked)}
                className="mt-0.5"
              />
              I understand that IdentityIQ billing is separate from my DisputeIQ subscription.
            </label>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0a0f1c]/85">
              <input
                type="checkbox"
                checked={ackDiy}
                onChange={(e) => setAckDiy(e.target.checked)}
                className="mt-0.5"
              />
              I accept the consumer disclosures and understand this is DIY dispute software, not a
              credit repair agency.
            </label>
          </section>

          <button
            disabled={!allAccepted}
            onClick={() => setStep("account")}
            className="w-full rounded-xl bg-[#0a0f1c] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-40"
          >
            Continue to account creation
          </button>

          {/* How setup works */}
          <section className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-5">
            <h3 className="text-sm font-semibold text-[#0a0f1c]">How setup works</h3>
            <ol className="mt-4 space-y-3 text-xs leading-relaxed text-[#3d3a2e]">
              {[
                [
                  "Create your DisputeIQ account",
                  "Set up your login so your dashboard, documents, and dispute workflow are ready.",
                ],
                [
                  "Activate IdentityIQ",
                  "Use the IdentityIQ link inside DisputeIQ to activate your monitoring and report access.",
                ],
                [
                  "Access your report",
                  "Once IdentityIQ is active, return to DisputeIQ and connect or import your report.",
                ],
                [
                  "Upload your documents",
                  "Add your ID, proof of address, prior bureau letters, collection notices, and any supporting evidence.",
                ],
                [
                  "Review your report summary",
                  "DisputeIQ walks you through negative items, inquiries, public records, and dispute opportunities.",
                ],
                [
                  "Start your dispute workflow",
                  "Choose what to challenge, organize supporting documents, and begin tracking progress.",
                ],
              ].map(([title, body], i) => (
                <li key={title as string} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[#0a0f1c]">{title}</p>
                    <p className="mt-0.5 text-[#3d3a2e]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Helpful documents */}
          <section className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-5">
            <h3 className="text-sm font-semibold text-[#0a0f1c]">Helpful documents to upload</h3>
            <p className="mt-1 text-xs text-[#6b6556]">
              You don&apos;t need every item to start — more documentation gives you a stronger
              file.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-xs leading-relaxed text-[#3d3a2e] sm:grid-cols-2">
              {HELPFUL_DOCS.map((doc) => (
                <li key={doc} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* What happens next */}
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            <h3 className="text-sm font-semibold text-indigo-900">What happens next</h3>
            <p className="mt-1 text-xs text-indigo-900/80">
              After creating your account, DisputeIQ walks you through each step.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-indigo-900/85">
              {NEXT_STEPS.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {step === "account" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <section className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-5">
            <h3 className="text-sm font-semibold text-[#0a0f1c]">Create your account</h3>
            <p className="mt-1 text-xs text-[#6b6556]">
              After creating your account you&apos;ll go straight to the guided IdentityIQ setup.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-[#0a0f1c]/15 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                className="w-full rounded-lg border border-[#0a0f1c]/15 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
              {err && <p className="text-sm text-rose-600">{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#0a0f1c] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Creating account…" : "Create account & continue to setup"}
              </button>
              <button
                type="button"
                onClick={() => setStep("disclosures")}
                className="w-full text-xs text-[#0a0f1c]/60 hover:underline"
              >
                ← Back to disclosures
              </button>
            </div>
          </section>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-[#0a0f1c]/55">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
