import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";

export const metadata = {
  title: "Trust Center — DisputeIQ",
  description:
    "Our security posture, your rights, and the things we explicitly do not do. Built like a financial institution.",
};

export default function TrustCenter() {
  const pillars = [
    {
      k: "Encryption",
      t: "AES-256 at rest",
      d: "Every document and credit file is encrypted at rest with AES-256, TLS 1.3 in transit. Keys are managed in an isolated KMS.",
    },
    {
      k: "Isolation",
      t: "Per-tenant boundaries",
      d: "Your data lives in a tenant-isolated namespace. We never co-mingle reports, vault contents, or activity logs across users.",
    },
    {
      k: "Audit",
      t: "Immutable activity log",
      d: "Every action — uploads, drafts, dispatches, deletions — is timestamped, signed, and exportable on demand.",
    },
    {
      k: "Data",
      t: "Zero data brokers",
      d: "We never sell, share, or rent your data to third parties. There is no advertising business model attached to your file.",
    },
    {
      k: "Process",
      t: "Confirmed dispatch only",
      d: "Nothing leaves the platform without your explicit confirmation. There is no auto-send. There are no hidden actions.",
    },
    {
      k: "Portability",
      t: "Export anytime",
      d: "You can export your full history, audit log, documents, and dispatch records at any time, in standard formats.",
    },
  ];

  const rights = [
    "You may dispute inaccuracies on your credit report yourself, for free, directly with the bureaus.",
    "You may request your annual free reports at annualcreditreport.com.",
    "You can revoke consent and close your account at any time.",
    "You can request export of all your data on demand.",
    "You can request deletion of your data, subject to legal retention requirements.",
  ];

  const dontDo = [
    "We do not guarantee removal of any item from your credit report.",
    "We do not guarantee any change in your credit score.",
    "We do not submit anything on your behalf without your explicit confirmation.",
    "We do not sell, rent, or share your data with marketing partners.",
    "We do not use your file for training third-party AI models.",
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[520px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Trust center
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-[68px]">
            Your file is yours.
            <br />
            <span className="italic">Always.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            DisputeIQ is engineered like a financial institution handles its own operations.
            Here is exactly what we do, what we don't do, and the rights you keep.
          </p>
        </div>
      </section>

      {/* Quick stats */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["AES-256", "Encryption at rest"],
              ["TLS 1.3", "Transport security"],
              ["SOC 2", "Controls aligned"],
              ["Zero", "Data brokers"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-2xl border border-border bg-surface p-7 text-center shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_18px_36px_-24px_rgba(10,15,28,0.12)]"
              >
                <p className="font-serif text-[34px] text-fg">{v}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-fg-subtle">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="mb-12 max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
              Security posture
            </p>
            <h2 className="mt-5 font-serif text-[36px] leading-[1.1] tracking-tight text-fg sm:text-[44px]">
              Six commitments. Documented and audited.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.t}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_18px_36px_-24px_rgba(10,15,28,0.12)] transition hover:-translate-y-0.5 hover:border-indigo-500/40"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-600">
                  {p.k}
                </p>
                <h3 className="mt-5 font-serif text-[20px] text-fg">{p.t}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rights + Don't do (two columns) */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-border bg-surface p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-700">
                Your rights
              </p>
              <h3 className="mt-4 font-serif text-[28px] leading-tight text-fg">
                What you can always do.
              </h3>
              <ul className="mt-7 space-y-4 text-[14px] leading-relaxed text-fg-muted">
                {rights.map((r) => (
                  <li key={r} className="flex items-start gap-3">
                    <span className="mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[24px] border border-border bg-surface-strong p-10 text-white shadow-[0_24px_48px_-24px_rgba(10,15,28,0.45)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-rose-300">
                What we don't do
              </p>
              <h3 className="mt-4 font-serif text-[28px] leading-tight">
                Lines we don't cross.
              </h3>
              <ul className="mt-7 space-y-4 text-[14px] leading-relaxed text-white/80">
                {dontDo.map((r) => (
                  <li key={r} className="flex items-start gap-3">
                    <span className="mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance notice */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-28">
          <div className="rounded-[24px] border border-border bg-surface-muted p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
              Compliance notice
            </p>
            <p className="mt-5 text-[14px] leading-relaxed text-fg-muted">{COMPLIANCE_NOTICE}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-fg bg-fg px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-canvas transition hover:bg-fg/90"
              >
                See pricing →
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg transition hover:border-fg"
              >
                See the method
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
