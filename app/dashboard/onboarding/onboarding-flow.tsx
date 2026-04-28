"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnboardingStep } from "@/lib/onboarding";
import { CREDIT_MONITORING } from "@/lib/billing/plans";

const STEPS: { key: OnboardingStep; label: string; num: number }[] = [
  { key: "profile", label: "Personal info", num: 1 },
  { key: "subscription", label: "Choose plan", num: 2 },
  { key: "report_connect", label: "Import report", num: 3 },
  { key: "report_pending", label: "Report processing", num: 4 },
];

export function OnboardingFlow({
  currentStep,
  hasProfile,
  hasSubscription,
  reportCount,
}: {
  currentStep: OnboardingStep;
  hasProfile: boolean;
  hasSubscription: boolean;
  reportCount: number;
}) {
  return (
    <div className="mt-8 space-y-6">
      {/* Progress */}
      <ol className="flex gap-2">
        {STEPS.map((s) => {
          const done =
            (s.key === "profile" && hasProfile) ||
            (s.key === "subscription" && hasSubscription) ||
            (s.key === "report_connect" && reportCount > 0) ||
            (s.key === "report_pending" && currentStep === "ready");
          const active = s.key === currentStep;
          return (
            <li
              key={s.key}
              className={`flex-1 rounded-lg p-3 text-center text-xs font-semibold ${
                done
                  ? "bg-emerald-100 text-emerald-700"
                  : active
                    ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300"
                    : "bg-surface-muted text-fg-subtle"
              }`}
            >
              {s.num}. {s.label}
            </li>
          );
        })}
      </ol>

      {currentStep === "profile" && <ProfileStep />}
      {currentStep === "subscription" && <SubscriptionStep />}
      {currentStep === "report_connect" && <ReportConnectStep />}
      {currentStep === "report_pending" && (
        <div className="rounded-2xl border border-border-strong bg-surface p-6 text-center">
          <h2 className="text-lg font-semibold">Report processing</h2>
          <p className="mt-2 text-sm text-fg-muted">
            Your report was uploaded but we found 0 tradelines. This usually means the PDF
            format wasn't recognized. Try uploading again or contact support.
          </p>
          <Link
            href="/dashboard/reports"
            className="mt-4 inline-block rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-canvas hover:bg-fg/90"
          >
            Re-upload report
          </Link>
        </div>
      )}
    </div>
  );
}

function ProfileStep() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", dob: "", ssnLast4: "", address1: "", city: "", state: "", zip: "", phone: "",
  });

  function set(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed");
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-fg focus:border-indigo-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border-strong bg-surface p-6 space-y-4">
      <h2 className="text-lg font-semibold">Step 1: Personal information</h2>
      <p className="text-xs text-fg-muted">
        Required for dispute letters. All sensitive fields are encrypted at rest.
      </p>
      <input className={inputCls} placeholder="Full legal name" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Date of birth (MM/DD/YYYY)" required value={form.dob} onChange={(e) => set("dob", e.target.value)} />
        <input className={inputCls} placeholder="Last 4 of SSN" required maxLength={4} value={form.ssnLast4} onChange={(e) => set("ssnLast4", e.target.value)} />
      </div>
      <input className={inputCls} placeholder="Mailing address" required value={form.address1} onChange={(e) => set("address1", e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        <input className={inputCls} placeholder="City" required value={form.city} onChange={(e) => set("city", e.target.value)} />
        <input className={inputCls} placeholder="State (2-letter)" required maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value)} />
        <input className={inputCls} placeholder="ZIP code" required value={form.zip} onChange={(e) => set("zip", e.target.value)} />
      </div>
      <input className={inputCls} placeholder="Phone (optional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-fg py-3 text-sm font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50">
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

function SubscriptionStep() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const plans = [
    { code: "starter", name: "Starter", price: "$69/mo", packets: "1 packet/mo" },
    { code: "pro", name: "Pro", price: "$99/mo", packets: "3 packets/mo", featured: true },
    { code: "elite", name: "Elite", price: "$129/mo", packets: "5 packets/mo" },
  ];

  async function choose(code: string) {
    setBusy(code);
    setErr(null);
    try {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border-strong bg-surface p-6 space-y-4">
      <h2 className="text-lg font-semibold">Step 2: Choose your plan</h2>
      <p className="text-xs text-fg-muted">
        {CREDIT_MONITORING.disclosure}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.code}
            className={`rounded-xl border p-4 ${p.featured ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200" : "border-border-strong"}`}
          >
            <div className="text-xl font-bold text-fg">{p.price}</div>
            <div className="text-sm font-semibold">{p.name}</div>
            <div className="mt-1 text-xs text-fg-muted">{p.packets}</div>
            <button
              onClick={() => choose(p.code)}
              disabled={busy === p.code}
              className="mt-3 w-full rounded-lg bg-fg py-2 text-xs font-semibold text-canvas hover:bg-fg/90 disabled:opacity-50"
            >
              {busy === p.code ? "Loading…" : `Choose ${p.name}`}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <p className="text-[10px] text-fg-subtle">
        Extra packets after your included monthly amount: $19.95 each. Billed via Square.
      </p>
    </div>
  );
}

function ReportConnectStep() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border-strong bg-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold">Step 3: Get your credit report</h2>
        <p className="text-sm text-fg-muted">
          DisputeIQ works best with our supported MyScoreIQ credit report flow. Complete this
          step to unlock your report analysis and dispute workflow.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href="/dashboard/get-report"
            className="flex flex-col items-center rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 text-center hover:border-indigo-300"
          >
            <div className="text-sm font-semibold text-indigo-900">Activate MyScoreIQ</div>
            <div className="mt-1 text-xs text-indigo-900/70">
              Our supported credit report provider flow
            </div>
            <span className="mt-3 text-xs font-semibold text-indigo-600">
              Get started →
            </span>
          </Link>

          <Link
            href="/dashboard/reports"
            className="flex flex-col items-center rounded-xl border border-border-strong bg-surface p-5 text-center hover:border-border-strong"
          >
            <div className="text-sm font-semibold text-fg">Already have your report?</div>
            <div className="mt-1 text-xs text-fg-muted">
              Upload it directly to begin analysis
            </div>
            <span className="mt-3 text-xs font-semibold text-fg">
              Upload report →
            </span>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border-strong bg-surface p-4 text-sm text-fg-muted">
        <p className="font-semibold text-fg">Need help getting started?</p>
        <p className="mt-1 text-xs">
          Our support team can guide you through the MyScoreIQ setup if you get stuck. Email
          support@disputeiq.org and we&apos;ll walk you through it.
        </p>
      </div>
    </div>
  );
}
