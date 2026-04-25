"use client";

// Clerk sign-up — catch-all route. We gate Clerk's <SignUp> behind the
// three required disclosures so users can't bypass the consent click.
// The checkbox state is local React state (not persisted to a DB) — the
// user must check all three to reveal the Clerk widget.

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { useState } from "react";

const HELPFUL_DOCS = [
  "Government-issued ID",
  "Proof of address",
  "Social Security verification (only if needed)",
  "Collection letters",
  "Credit denial letters",
  "Medical billing records (if relevant)",
  "Bankruptcy discharge or court paperwork",
  "Police report / identity theft affidavit (if relevant)",
  "Previous bureau responses",
  "Letters already sent to bureaus or creditors",
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
  const [ackMonitoring, setAckMonitoring] = useState(false);
  const [ackBilling, setAckBilling] = useState(false);
  const [ackDiy, setAckDiy] = useState(false);
  const allAccepted = ackMonitoring && ackBilling && ackDiy;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Create your account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Join DisputeIQ
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
          DisputeIQ is the DIY credit workflow platform for disciplined disputes, certified
          mail tracking, and escalation. Setup takes a few minutes and is fully guided.
        </p>
      </header>

      {/* ScrewedUpCredit migration banner */}
      <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800">
          Switching from ScrewedUpCredit?
        </p>
        <h2 className="mt-2 text-lg font-semibold text-fg">
          Already a ScrewedUpCredit customer?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          If you previously used ScrewedUpCredit with MyFreeScoreIQ, you now need to switch
          to <span className="font-semibold text-fg">IdentityIQ</span> for report
          access and monitoring inside DisputeIQ. Create your DisputeIQ account below,
          complete your IdentityIQ enrollment, and then return to connect your report.
        </p>
        <p className="mt-2 text-xs text-fg-muted">
          Already have a DisputeIQ account?{" "}
          <Link href="/sign-in" className="font-semibold text-amber-800 underline">
            Sign in here
          </Link>
          .
        </p>
      </section>

      {/* Disclosure bullets */}
      <section className="mb-5 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-fg">Before continuing, please note</h3>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-fg-muted">
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

      {/* Checkboxes */}
      <section className="mb-6 space-y-3">
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-fg/85">
          <input
            type="checkbox"
            checked={ackMonitoring}
            onChange={(e) => setAckMonitoring(e.target.checked)}
            className="mt-0.5"
          />
          I understand that IdentityIQ is required for report access and monitoring in
          DisputeIQ.
        </label>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-fg/85">
          <input
            type="checkbox"
            checked={ackBilling}
            onChange={(e) => setAckBilling(e.target.checked)}
            className="mt-0.5"
          />
          I understand that IdentityIQ billing is separate from my DisputeIQ subscription.
        </label>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-fg/85">
          <input
            type="checkbox"
            checked={ackDiy}
            onChange={(e) => setAckDiy(e.target.checked)}
            className="mt-0.5"
          />
          I accept the consumer disclosures and understand this is DIY dispute software, not
          a credit repair agency.
        </label>
      </section>

      {/* Clerk widget — revealed only after all 3 boxes are checked */}
      {allAccepted ? (
        <section className="flex justify-center">
          <SignUp
            signInUrl="/sign-in"
            forceRedirectUrl="/dashboard/get-report?welcome=1"
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border-strong bg-surface-muted p-6 text-center text-sm text-fg-muted">
          Check all three boxes above to continue to account creation.
        </section>
      )}

      {/* How setup works */}
      <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-fg">How setup works</h3>
        <ol className="mt-4 space-y-3 text-xs leading-relaxed text-fg-muted">
          {[
            ["Create your DisputeIQ account", "Set up your login so your dashboard is ready."],
            [
              "Activate IdentityIQ",
              "Use the IdentityIQ link inside DisputeIQ to activate monitoring + report access.",
            ],
            [
              "Access your report",
              "Once IdentityIQ is active, return to DisputeIQ and connect or import your report.",
            ],
            [
              "Upload your documents",
              "Add your ID, proof of address, prior bureau letters, collection notices.",
            ],
            [
              "Review your report summary",
              "DisputeIQ walks you through negatives, inquiries, public records, opportunities.",
            ],
            [
              "Start your dispute workflow",
              "Choose what to challenge, organize evidence, begin tracking progress.",
            ],
          ].map(([title, body], i) => (
            <li key={title as string} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-fg">{title}</p>
                <p className="mt-0.5 text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Helpful documents */}
      <section className="mt-5 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-fg">Helpful documents to upload</h3>
        <p className="mt-1 text-xs text-fg-subtle">
          You don&apos;t need every item to start — more documentation gives you a stronger
          file.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-xs leading-relaxed text-fg-muted sm:grid-cols-2">
          {HELPFUL_DOCS.map((doc) => (
            <li key={doc} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{doc}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What happens next */}
      <section className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
        <h3 className="text-sm font-semibold text-indigo-900">What happens next</h3>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-indigo-900/85">
          {NEXT_STEPS.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-fg-subtle">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
