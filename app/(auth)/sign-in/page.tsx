"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) setErr("Invalid email or password.");
      else window.location.href = "/dashboard";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-[#0a0f1c]">Sign in</h1>

      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm">
        <p className="font-semibold text-indigo-900">Returning Screwed Up Credit customer?</p>
        <p className="mt-1 text-indigo-900/75">
          If you already have an active DisputeIQ account, log in below with your existing
          credentials. Your dashboard and report data will be ready.
        </p>
      </div>

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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#0a0f1c] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[#0a0f1c]/50">
        Don't have an account?{" "}
        <Link href="/sign-up" className="font-semibold underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
