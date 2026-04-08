import Link from "next/link";
import { URLS } from "@/lib/urls";

export const metadata = {
  title: "How it works — DisputeIQ",
  description:
    "The DisputeIQ method: upload, analyze, prepare, dispatch, and track — with audit-grade transparency at every step.",
};

const chapters = [
  {
    n: "I",
    t: "Upload your reports",
    d: "Drop your tri-merge PDF. The file is encrypted on upload and stored in an isolated vault keyed to you alone. We never co-mingle data across users.",
    bullets: ["Encrypted on upload", "Per-tenant vault", "Hash-verified"],
  },
  {
    n: "II",
    t: "AI analyzes & flags",
    d: "Cross-bureau diffing surfaces balance, status, date, and ownership inconsistencies — ranked by severity. Every finding is explained in plain English.",
    bullets: ["Cross-bureau diffs", "Severity-ranked", "Plain-English notes"],
  },
  {
    n: "III",
    t: "Review & prepare",
    d: "Factual dispute documents are drafted server-side and held until your review. You see the full document before anything is dispatched. Nothing auto-sends.",
    bullets: ["Server-side drafts", "Held for review", "Confirmation required"],
  },
  {
    n: "IV",
    t: "Dispatch via certified mail",
    d: "Print and mail yourself, or dispatch through our USPS certified mail integration. You get electronic return receipts and live tracking on every letter.",
    bullets: ["USPS certified", "Return receipts", "Live tracking"],
  },
  {
    n: "V",
    t: "Track every update",
    d: "Delivery scans, bureau responses, and follow-ups sync into an immutable activity timeline. You always know what happened, when, and why.",
    bullets: ["Immutable log", "Bureau responses", "Exportable history"],
  },
];

export default function HowItWorks() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[520px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            The method
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-[#0a0f1c] sm:text-[68px]">
            Five chapters.
            <br />
            <span className="italic">Total transparency.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-[#4a4638]">
            No black box. No hidden actions. You confirm every step that leaves the platform.
          </p>
        </div>
      </section>

      {/* Chapters */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-20">
          <ol className="space-y-6">
            {chapters.map((c) => (
              <li
                key={c.n}
                className="group relative overflow-hidden rounded-[24px] border border-[#e8e4d8] bg-white p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.14)] transition hover:-translate-y-0.5 hover:border-indigo-500/40"
              >
                <div className="grid gap-8 lg:grid-cols-[auto_1fr_auto] lg:items-start">
                  <div className="flex items-baseline gap-4 lg:flex-col lg:items-start">
                    <span className="font-serif text-[64px] italic leading-none text-indigo-600/80 lg:text-[88px]">
                      {c.n}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a8472]">
                      Chapter {c.n}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-serif text-[28px] leading-tight tracking-tight text-[#0a0f1c]">
                      {c.t}
                    </h2>
                    <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#4a4638]">
                      {c.d}
                    </p>
                  </div>
                  <ul className="space-y-2 lg:min-w-[180px]">
                    {c.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2 rounded-lg border border-[#e8e4d8] bg-[#faf9f4] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[#3d3a2e]"
                      >
                        <span className="h-1 w-1 rounded-full bg-emerald-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-28">
          <div className="relative overflow-hidden rounded-[28px] border border-white/5 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-12 text-center text-white lg:p-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(139,92,246,0.3),transparent)]" />
            <div className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
                Ready when you are
              </p>
              <h2 className="mx-auto mt-5 max-w-2xl font-serif text-[36px] leading-[1.1] tracking-tight sm:text-[48px]">
                Open your portal in minutes.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-white/70">
                No bureau contact ever happens without your explicit confirmation.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={`${URLS.app}/sign-up`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a0f1c] transition hover:scale-[1.015]"
                >
                  Request access →
                </a>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
