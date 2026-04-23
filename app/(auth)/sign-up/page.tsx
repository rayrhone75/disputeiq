"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { DISCLOSURES } from "@/lib/billing/disclosures";

export default function SignUpPage() {
  const [step, setStep] = useState<"disclosures" | "account">("disclosures");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [acceptMonitoring, setAcceptMonitoring] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accept || !acceptMonitoring) {
      setErr("Please accept all required disclosures.");
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
        setErr(data.error === "EMAIL_IN_USE" ? "An account with this email already exists." : "Could not create account.");
        return;
      }
      await signIn("credentials", { email, password, redirect: false });
      window.location.href = "/dashboard";
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-[#0a0f1c]">Create your account</h1>

      {/* Existing customer notice */}
      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm">
        <p className="font-semibold text-indigo-900">Already a Screwed Up Credit customer?</p>
        <p className="mt-1 text-indigo-900/75">
          If you already have an active IdentityIQ account,{" "}
          <Link href="/sign-in" className="font-semibold underline">
            sign in here
          </Link>{" "}
          instead of creating a new account.
        </p>
      </div>

      {step === "disclosures" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <p className="font-semibold">Before continuing, please note:</p>
            <ul className="mt-2 space-y-2 text-xs">
              <li>• MyDIY Credit Repair software is billed separately from IdentityIQ.</li>
              <li>• IdentityIQ is required for report access and monitoring.</li>
              <li>• IdentityIQ charges $24.95/month, billed separately.</li>
              <li>• Your chosen software plan is billed separately.</li>
              <li>• Included packet limits reset each billing cycle.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#0a0f1c]/10 bg-white p-4 text-xs text-[#0a0f1c]/70">
            <p>{DISCLOSURES.software}</p>
            <p className="mt-2">{DISCLOSURES.separateBilling}</p>
            <p className="mt-2">{DISCLOSURES.outcome}</p>
          </div>

          <label className="flex items-start gap-2 text-xs text-[#0a0f1c]/80">
            <input type="checkbox" checked={acceptMonitoring} onChange={(e) => setAcceptMonitoring(e.target.checked)} className="mt-0.5" />
            I understand IdentityIQ is required and billed separately at $24.95/month.
          </label>

          <label className="flex items-start gap-2 text-xs text-[#0a0f1c]/80">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5" />
            I accept the consumer disclosures and understand this is DIY dispute software, not a credit repair agency.
          </label>

          <button
            disabled={!accept || !acceptMonitoring}
            onClick={() => setStep("account")}
            className="w-full rounded-xl bg-[#0a0f1c] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Continue to account creation
          </button>
        </div>
      )}

      {step === "account" && (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-[#0a0f1c]/15 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-[#0a0f1c]/15 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#0a0f1c] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setStep("disclosures")}
            className="w-full text-xs text-[#0a0f1c]/60 hover:underline"
          >
            ← Back to disclosures
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-[#0a0f1c]/50">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
