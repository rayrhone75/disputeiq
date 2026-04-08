import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";
import { URLS } from "@/lib/urls";
import { Section } from "@/components/marketing/Section";

/* ----------------------------------------------------------------------------
 * DisputeIQ — premium marketing homepage.
 * Ivory primary, selective dark drama sections.
 * -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <>
      <Hero />
      <PressStrip />
      <Principles />
      <DarkProof />
      <Storyline />
      <AISuite />
      <Testimonials />
      <PricingTeaser />
      <FinalCTA />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* subtle warm gradient + grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[620px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-3xl" />
        <div className="absolute right-[-14%] top-[30%] h-[460px] w-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.08),transparent)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(10,15,28,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(10,15,28,0.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-32">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d9d3c0] bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4a4638] backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
            </span>
            Private beta · invitation access
          </span>

          <h1 className="mt-7 font-serif text-[56px] font-medium leading-[1.02] tracking-[-0.02em] text-[#0a0f1c] sm:text-[74px]">
            Your credit file,
            <br />
            <span className="italic">
              under your{" "}
              <span className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 bg-clip-text text-transparent">
                command
              </span>
              .
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-[1.65] text-[#3d3a2e]">
            DisputeIQ is the executive workspace for reviewing your credit reports,
            identifying potential inaccuracies, preparing dispute documents, and tracking
            certified mailings — with audit-grade trust built into every step.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={`${URLS.app}/sign-up`}
              className="group inline-flex items-center gap-2 rounded-xl bg-[#0a0f1c] px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_14px_40px_-14px_rgba(10,15,28,0.6)] transition hover:scale-[1.015] hover:bg-[#111827]"
            >
              Request access
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9d3c0] bg-white/70 px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0a0f1c] transition hover:border-[#0a0f1c] hover:bg-white"
            >
              See the method
            </Link>
          </div>

          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-[#d9d3c0] pt-8">
            {[
              ["11,400+", "Items analyzed"],
              ["$0", "Bureau contact"],
              ["256-bit", "Encryption"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-serif text-[26px] text-[#0a0f1c]">{v}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8a8472]">{l}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-xl text-[11px] leading-relaxed text-[#8a8472]">
            {COMPLIANCE_NOTICE}
          </p>
        </div>

        <DashboardMock />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard mockup (dark card floating on ivory)                             */
/* -------------------------------------------------------------------------- */
function DashboardMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-10 -z-10 rounded-[40px] bg-gradient-to-br from-indigo-200/70 via-violet-200/50 to-transparent blur-3xl" />

      {/* Floating corner badge */}
      <div className="absolute -right-3 -top-3 z-10 hidden rotate-3 rounded-2xl border border-[#e8e4d8] bg-white/95 px-4 py-3 text-[11px] shadow-[0_20px_50px_-20px_rgba(10,15,28,0.3)] backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="uppercase tracking-[0.18em] text-[#6b6556]">Live</span>
        </div>
        <p className="mt-1 font-serif text-sm text-[#0a0f1c]">Audit log synced</p>
      </div>

      <div className="relative rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-5 shadow-[0_50px_120px_-30px_rgba(10,15,28,0.45)]">
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />

        <div className="relative mb-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            DisputeIQ · Command Center
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-2">
          {[
            ["Active", "4", "+2 wk"],
            ["Flagged", "11", "3 high"],
            ["In transit", "2", "certified"],
          ].map(([l, v, d]) => (
            <div key={l as string} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/40">{l}</p>
              <p className="mt-1.5 font-serif text-xl text-white">{v}</p>
              <p className="text-[10px] text-emerald-300/85">{d}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-4 overflow-hidden rounded-xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.14] to-violet-500/[0.05] p-4">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/25 blur-3xl" />
          <div className="relative flex items-center gap-2">
            <span className="rounded-md bg-indigo-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
              AI Insight
            </span>
            <span className="text-[10px] text-white/50">just now</span>
          </div>
          <p className="relative mt-2.5 text-[13px] leading-relaxed text-white/90">
            Capital One tradeline shows a balance mismatch across two bureaus.
            <span className="text-white/60"> Review before disputing.</span>
          </p>
          <div className="relative mt-3 flex items-center gap-2">
            <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
              Dispute Ready
            </span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/65">
              Equifax · Experian
            </span>
          </div>
        </div>

        <div className="relative mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Activity timeline</p>
          <ol className="mt-3 space-y-2.5">
            {[
              ["Cross-bureau audit complete", "now", "bg-indigo-400"],
              ["Letter mailed via USPS certified", "1h", "bg-emerald-400"],
              ["Report ingested & hashed", "3h", "bg-white/40"],
            ].map(([t, ts, dot]) => (
              <li key={t as string} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2.5 text-white/85">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  {t}
                </span>
                <span className="font-mono text-[10px] text-white/40">{ts}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="font-mono text-white/85">USPS 9214-8901-2347-3318</span>
          </div>
          <span className="text-white/50">In transit · ETA Wed</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Press strip                                                               */
/* -------------------------------------------------------------------------- */
function PressStrip() {
  const items = [
    "AES-256 encryption",
    "SOC 2-aligned",
    "Audit-grade log",
    "USPS certified mail",
    "No data sales",
    "FCRA-literate workflows",
  ];
  return (
    <section className="relative border-y border-[#e8e4d8] bg-white/60">
      <div className="mx-auto max-w-7xl px-6 py-9">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-[#8a8472]">
          Built to the standard of
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[11px] uppercase tracking-[0.22em] text-[#4a4638]">
          {items.map((i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-emerald-600" />
              {i}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Principles                                                                */
/* -------------------------------------------------------------------------- */
function Principles() {
  const cards = [
    {
      k: "Principle 01",
      t: "Accuracy over speed",
      d: "Most tools push you to fire off disputes. DisputeIQ helps you act correctly — with a factual basis, every time.",
    },
    {
      k: "Principle 02",
      t: "Transparency by design",
      d: "Every action is logged, timestamped, and exportable. You always know what happened, when, and why.",
    },
    {
      k: "Principle 03",
      t: "You stay in control",
      d: "Nothing is sent without your explicit confirmation. No auto-dispatch. No hidden actions.",
    },
    {
      k: "Principle 04",
      t: "Institutional security",
      d: "AES-256 at rest, TLS 1.3 in transit, isolated document vault. We never sell or share your data.",
    },
  ];
  return (
    <Section
      eyebrow="The method"
      title="Built on four non-negotiable principles."
      subtitle="DisputeIQ isn't another credit app. It's a disciplined workspace that treats your file with the precision a bank uses on its own books."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.t}
            className="group relative overflow-hidden rounded-2xl border border-[#e8e4d8] bg-white p-7 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-[0_1px_0_0_rgba(10,15,28,0.04),0_28px_50px_-22px_rgba(79,70,229,0.28)]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-600">{c.k}</p>
            <h3 className="mt-5 font-serif text-[22px] text-[#0a0f1c]">{c.t}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-[#4a4638]">{c.d}</p>
            <div className="absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dark proof — security + trust pillars                                     */
/* -------------------------------------------------------------------------- */
function DarkProof() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-10 text-white lg:p-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          <div className="relative grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-300/90">
                Security & trust
              </p>
              <h2 className="mt-4 font-serif text-[40px] leading-[1.08] tracking-tight sm:text-[52px]">
                Your file is yours.
                <br />
                <span className="italic text-white/85">Always.</span>
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
                DisputeIQ is engineered like a financial institution handles its own operations:
                encrypted at rest, isolated by tenant, logged immutably, and never sold or shared
                with third parties.
              </p>
              <ul className="mt-8 grid gap-3 text-[13px] text-white/80 sm:grid-cols-2">
                {[
                  "AES-256 at rest, TLS 1.3 in transit",
                  "Per-tenant data isolation",
                  "Vaulted document storage",
                  "Immutable audit log",
                  "No third-party data brokers",
                  "Exportable history, on demand",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["AES-256", "Encryption at rest"],
                ["TLS 1.3", "Transport security"],
                ["SOC 2", "Controls aligned"],
                ["Zero", "Data brokers"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center transition hover:border-indigo-400/50 hover:bg-white/[0.05]"
                >
                  <p className="font-serif text-[34px] text-white">{v}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/50">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Storyline                                                                 */
/* -------------------------------------------------------------------------- */
function Storyline() {
  const steps = [
    { n: "I", t: "Upload", d: "Drop your tri-merge PDF. It's encrypted on upload and stored in an isolated vault keyed to you alone." },
    { n: "II", t: "Analyze", d: "Cross-bureau diffing surfaces balance, status, date, and ownership inconsistencies — ranked by severity." },
    { n: "III", t: "Prepare", d: "Factual dispute documents are drafted server-side and held until your review. Nothing auto-sends." },
    { n: "IV", t: "Dispatch", d: "Print and mail yourself, or dispatch through our USPS certified mail integration with return receipts." },
    { n: "V", t: "Track", d: "Delivery scans, bureau responses, and follow-ups sync into an immutable activity timeline." },
  ];
  return (
    <Section
      eyebrow="The workflow"
      title="Five chapters. Total transparency."
      subtitle="No black box. No surprises. You confirm every step that leaves the platform."
    >
      <div className="grid gap-4 lg:grid-cols-5">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="relative overflow-hidden rounded-2xl border border-[#e8e4d8] bg-white p-6 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:-translate-y-0.5 hover:border-indigo-500/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-[22px] italic text-indigo-600">{s.n}</span>
              {i < 4 && <span className="text-[#cbc4ad]">→</span>}
            </div>
            <h3 className="mt-5 font-serif text-[18px] text-[#0a0f1c]">{s.t}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-[#4a4638]">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI Suite                                                                  */
/* -------------------------------------------------------------------------- */
function AISuite() {
  return (
    <Section
      eyebrow="DisputeIQ AI"
      title="An assistant that reads the fine print for you."
      subtitle="Ask anything about your file. Understand everything. Move forward with clarity."
    >
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="relative">
          <div className="absolute -inset-8 -z-10 rounded-[36px] bg-gradient-to-br from-indigo-200/70 via-violet-200/50 to-transparent blur-3xl" />
          <div className="relative rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-6 text-white shadow-[0_50px_120px_-30px_rgba(10,15,28,0.45)]">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_-4px_rgba(139,92,246,0.6)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-[#0a0f1c]" />
                <div className="absolute inset-0 flex items-center justify-center font-serif text-sm italic text-white/95">
                  D
                </div>
              </div>
              <div>
                <p className="font-serif text-[15px]">DisputeIQ AI</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">
                  Online · reading your file
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-[13px]">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-500/25 px-4 py-2.5 text-white/95">
                Why is my Capital One account flagged?
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] px-4 py-3 leading-relaxed text-white/85">
                This account may be inaccurate because two bureaus report different balances —
                <span className="text-indigo-300"> $1,284</span> on Equifax vs
                <span className="text-indigo-300"> $1,402</span> on Experian. The $118 delta is above
                rounding tolerance.
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] px-4 py-3 leading-relaxed text-white/85">
                <span className="text-emerald-300">Next step:</span> pull your last statement to confirm
                the correct balance, then prepare a factual dispute. I can draft it for your review.
              </div>
            </div>
          </div>
        </div>

        <ul className="space-y-6">
          {[
            ["Explains flagged accounts", "Plain-English breakdowns of why something is suspicious — and what it isn't."],
            ["Suggests next actions", "Actionable next steps, ranked by impact and effort. No filler."],
            ["Identifies missing documents", "Knows what evidence each dispute type requires before you send it."],
            ["Tracks dispute progress", "Surfaces delivery scans, status changes, and bureau responses as they happen."],
            ["Simplifies complex reports", "Turns 60-page tri-merge reports into a clear, prioritized action list."],
          ].map(([t, d]) => (
            <li key={t} className="group flex items-start gap-4 border-l-2 border-[#e0dccf] pl-5 transition hover:border-indigo-600">
              <div>
                <p className="font-serif text-[18px] text-[#0a0f1c]">{t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#4a4638]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                              */
/* -------------------------------------------------------------------------- */
function Testimonials() {
  const quotes = [
    {
      q: "I finally understand my own credit file. The cross-bureau view surfaced three errors I'd been staring at for a year.",
      a: "Marcus R.",
      r: "Small business owner",
    },
    {
      q: "The certified mail tracking alone is worth it. I stopped worrying about whether letters arrived.",
      a: "Danielle P.",
      r: "Mortgage applicant",
    },
    {
      q: "Every other tool felt like a black box. DisputeIQ shows its work — that's why I trust it.",
      a: "Omar K.",
      r: "CPA, independent",
    },
  ];
  return (
    <Section
      eyebrow="Voices"
      title="Built for people who take their file seriously."
      subtitle="Early members describing the shift from confusion to control."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.a}
            className="relative flex h-full flex-col rounded-2xl border border-[#e8e4d8] bg-white p-8 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:border-indigo-500/40"
          >
            <div className="font-serif text-5xl leading-none text-indigo-600/30">&ldquo;</div>
            <blockquote className="mt-3 flex-1 font-serif text-[18px] leading-[1.5] text-[#0a0f1c]">
              {q.q}
            </blockquote>
            <figcaption className="mt-6 border-t border-[#e8e4d8] pt-5">
              <p className="text-[13px] font-semibold text-[#0a0f1c]">{q.a}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-[#8a8472]">{q.r}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing teaser                                                            */
/* -------------------------------------------------------------------------- */
function PricingTeaser() {
  return (
    <Section
      eyebrow="Investment"
      title="Premium tools. Honest pricing."
      subtitle="Pay only when you take action. Cancel anytime, export everything."
    >
      <div className="flex flex-col items-start justify-between gap-6 rounded-[22px] border border-[#e8e4d8] bg-white p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)] lg:flex-row lg:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-600">Action pricing</p>
          <p className="mt-3 font-serif text-[30px] leading-tight text-[#0a0f1c]">
            $19 software fee · $12.95 certified mailing
          </p>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#4a4638]">
            No subscription required. You only pay when you actually dispatch a letter.
            Full pricing, tiers, and enterprise options on the pricing page.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0a0f1c] px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_14px_40px_-14px_rgba(10,15,28,0.6)] transition hover:scale-[1.015] hover:bg-[#111827]"
        >
          View full pricing →
        </Link>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Final CTA                                                                 */
/* -------------------------------------------------------------------------- */
function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-28">
      <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-14 text-center text-white lg:p-20">
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
            Private beta · invitation access
          </p>
          <h2 className="mx-auto mt-5 max-w-3xl font-serif text-[42px] leading-[1.05] tracking-tight sm:text-[58px]">
            Move from confusion to control
            <br />
            <span className="italic text-white/85">in a single workspace.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
            Open your portal in minutes. Cancel anytime. No bureau contact ever happens without your
            explicit confirmation.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`${URLS.app}/sign-up`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a0f1c] shadow-[0_18px_60px_-14px_rgba(255,255,255,0.55)] transition hover:scale-[1.015]"
            >
              Request access →
            </a>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
            >
              See the method
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
