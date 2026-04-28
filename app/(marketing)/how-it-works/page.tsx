import Link from "next/link";
import { URLS } from "@/lib/urls";

export const metadata = {
  title: "How it works — DisputeIQ",
  description:
    "The full DisputeIQ loop: import, review, build, send, track, parse responses, and escalate — with audit-grade transparency at every step.",
};

const chapters = [
  {
    n: "I",
    t: "Import your report",
    d: "Drop your tri-merge PDF. Our deep parser reads Equifax, Experian, and TransUnion columns row-by-row — dates, balances, statuses, and ownership flags — then stores the file in a per-tenant encrypted vault.",
    bullets: ["Tri-merge parser", "Per-tenant vault", "Hash-verified"],
  },
  {
    n: "II",
    t: "Review AI findings",
    d: "Cross-bureau diffing and a rule-based signal engine surface every inconsistency, ranked by severity. Each finding is explained in plain English with the legal basis quoted — FCRA §1681i, §1681s-2, and more.",
    bullets: ["Severity-ranked", "Plain-English notes", "Legal basis cited"],
  },
  {
    n: "III",
    t: "Build the bureau packet",
    d: "Factual dispute letters are drafted server-side, bundled with parsed evidence, and held until your review. You see the full packet — letter, report excerpts, ID docs — before anything is dispatched.",
    bullets: ["Server-side drafts", "Evidence bundled", "Held for review"],
  },
  {
    n: "IV",
    t: "Send certified dispute",
    d: "Print and mail yourself, or dispatch through our USPS certified mail integration. You get electronic return receipts, tracking numbers, and proof of service on every letter.",
    bullets: ["USPS certified", "Return receipts", "Proof of service"],
  },
  {
    n: "V",
    t: "Track delivery",
    d: "Delivery scans, signature events, and bureau milestones sync into an immutable timeline. The 30-day FCRA clock starts on the scan — and the platform tracks it for you.",
    bullets: ["Live delivery scans", "Immutable log", "FCRA countdown"],
  },
  {
    n: "VI",
    t: "Upload bureau response",
    d: "Drop the bureau's response letter and our AI parser classifies it — verified, updated, deleted, stall, no-investigation, or unclear — then recommends the next legal move with the exact statute.",
    bullets: ["AI response parser", "Six verdict types", "Next-step guidance"],
  },
  {
    n: "VII",
    t: "Re-dispute or escalate",
    d: "If the bureau stalled or verified without investigation, the escalation engine drafts round two, a Method of Verification demand, a CFPB complaint, or a direct §623(b) letter to the furnisher — in that order.",
    bullets: ["Round-2 drafter", "MOV + CFPB", "Direct furnisher §623(b)"],
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
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-[68px]">
            Seven chapters.
            <br />
            <span className="italic">The full dispute loop.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            Import, review, build, send, track, parse, escalate. No black box, no hidden actions — you confirm every step that leaves the platform.
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
                className="group relative overflow-hidden rounded-[24px] border border-border bg-surface p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.14)] transition hover:-translate-y-0.5 hover:border-indigo-500/40"
              >
                <div className="grid gap-8 lg:grid-cols-[auto_1fr_auto] lg:items-start">
                  <div className="flex items-baseline gap-4 lg:flex-col lg:items-start">
                    <span className="font-serif text-[64px] italic leading-none text-indigo-600/80 lg:text-[88px]">
                      {c.n}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
                      Chapter {c.n}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-serif text-[28px] leading-tight tracking-tight text-fg">
                      {c.t}
                    </h2>
                    <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                      {c.d}
                    </p>
                  </div>
                  <ul className="space-y-2 lg:min-w-[180px]">
                    {c.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-fg-muted"
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
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg transition hover:scale-[1.015]"
                >
                  Request access →
                </Link>
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
