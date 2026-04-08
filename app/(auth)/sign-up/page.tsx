"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
      setErr("Could not create account.");
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    window.location.href = "/dashboard";
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-3 text-xs text-slate-500">{COMPLIANCE_NOTICE}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input className="w-full rounded border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          I accept the consumer disclosures and affiliate disclosure.
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={!accept} className="w-full rounded bg-brand-700 px-4 py-2 text-white disabled:opacity-50">Continue</button>
      </form>
    </main>
  );
}
