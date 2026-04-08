"use client";
import { useState } from "react";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";

export default function DisclosuresPage() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const ok = a && b;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">Required disclosures</h1>
      <p className="mt-4 text-slate-700">{COMPLIANCE_NOTICE}</p>
      <label className="mt-6 flex items-start gap-3">
        <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />
        <span>I have read and accept the consumer disclosures and privacy policy.</span>
      </label>
      <label className="mt-3 flex items-start gap-3">
        <input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} />
        <span>I acknowledge the affiliate disclosure for credit-monitoring partner links.</span>
      </label>
      <button disabled={!ok} className="mt-6 rounded bg-brand-700 px-4 py-2 text-white disabled:opacity-50">
        Continue
      </button>
    </main>
  );
}
