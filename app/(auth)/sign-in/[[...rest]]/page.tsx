// Clerk sign-in — catch-all route so Clerk can own its sub-steps
// (verification codes, password reset, etc.) under /sign-in/*.

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign in — DisputeIQ",
};

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0a0f1c]">
          Sign in to DisputeIQ
        </h1>
      </header>

      {/* ScrewedUpCredit migration notice */}
      <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800">
          Switching from ScrewedUpCredit?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#3d3a2e]">
          If you previously used ScrewedUpCredit with MyFreeScoreIQ, DisputeIQ now uses{" "}
          <span className="font-semibold text-[#0a0f1c]">IdentityIQ</span> for report access
          and monitoring. Create a fresh account below, then we&apos;ll guide you through
          IdentityIQ setup.
        </p>
      </div>

      <div className="flex justify-center">
        <SignIn signUpUrl="/sign-up" />
      </div>

      <p className="mt-8 text-center text-xs text-[#0a0f1c]/55">
        New here?{" "}
        <Link href="/sign-up" className="font-semibold underline">
          Create your DisputeIQ account
        </Link>
      </p>
    </main>
  );
}
