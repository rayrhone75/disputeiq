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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Sign in to DisputeIQ
        </h1>
      </header>

      {/* Provider notice */}
      <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-800">
          Supported report provider
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          DisputeIQ uses{" "}
          <span className="font-semibold text-fg">MyScoreIQ</span> for report access and
          monitoring. After signing in, activate MyScoreIQ from your dashboard, then
          return to connect your report.
        </p>
      </div>

      <div className="flex justify-center">
        <SignIn
          signUpUrl="/sign-up"
          forceRedirectUrl="/after-sign-in"
          fallbackRedirectUrl="/after-sign-in"
        />
      </div>

      <p className="mt-8 text-center text-xs text-fg-subtle">
        New here?{" "}
        <Link href="/sign-up" className="font-semibold underline">
          Create your DisputeIQ account
        </Link>
      </p>
    </main>
  );
}
