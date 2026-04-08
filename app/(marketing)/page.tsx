import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";
import { URLS } from "@/lib/urls";

/* ----------------------------------------------------------------------------
 * DisputeIQ — premium marketing homepage.
 * Luxury fintech / legal-tech composition. Serif + sans pairing.
 * -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden bg-[#070a14] text-white">
      <AmbientGlow />
      <Topbar />
      <Hero />
      <PressStrip />
      <Principles />
      <Storyline />
      <AISuite />
      <TrustPillars />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ambient                                                                   */
/* -------------------------------------------------------------------------- */
function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute left-1/2 top-[-12%] h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)] blur-3xl" />
      <div className="absolute right-[-10%] top-[36%] h-[560px] w-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.16),transparent)] blur-3xl" />
      <div className="absolute left-[-14%] top-[68%] h-[520px] w-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.09),transparent)] blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Topbar                                                                    */
/* -------------------------------------------------------------------------- */
function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070a14]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_-4px_rgba(139,92,246,0.6)]">
            <div className="absolute inset-[2px] rounded-[7px] bg-[#070a14]" />
            <div className="absolute inset-0 flex items-center justify-center font-serif text-sm italic text-white/95">
              D
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-[15px] font-semibold tracking-tight">DisputeIQ</span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-white/40">
              Audit-grade credit operations
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-9 text-[13px] text-white/55 md:flex">
          <Link href="/how-it-works" className="transition hover:text-white">Product</Link>
          <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
          <Link href="/trust-center" className="transition hover:text-white">Trust center</Link>
          <Link href="/how-it-works" className="transition hover:text-white">Method</Link>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={`${URLS.app}/sign-in`}
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-white/75 transition hover:text-white sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href={`${URLS.app}/sign-up`}
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0b0f1a] shadow-[0_10px_40px_-12px_rgba(255,255,255,0.45)] transition hover:shadow-[0_14px_44px_-10px_rgba(255,255,255,0.55)]"
          >
            Open the portal
            <span className="transition group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 pb-28 pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-32">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Private beta · invitation access
          </span>

          <h1 className="mt-7 font-serif text-[56px] font-medium leading-[1.02] tracking-[-0.02em] text-white sm:text-[72px]">
            Your credit file,
            <br />
            <span className="italic text-white/90">
              under your{" "}
              <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
                command
              </span>
              .
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-[1.65] text-white/65">
            DisputeIQ is the executive workspace for reviewing your credit reports,
            identifying potential inaccuracies, preparing dispute documents, and tracking
            certified mailings — with audit-grade trust built into every step.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={`${URLS.app}/sign-up`}
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0b0f1a] shadow-[0_14px_48px_-14px_rgba(255,255,255,0.55)] transition hover:scale-[1.015]"
            >
              Request access
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:border-white/30 hover:bg-white/[0.07]"
            >
              See the method
            </Link>
          </div>

          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {[
              ["11,400+", "Items analyzed"],
              ["$0", "We never contact bureaus"],
              ["256-bit", "End-to-end encryption"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-serif text-2xl text-white">{v}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/40">{l}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-xl text-[11px] leading-relaxed text-white/35">
            {COMPLIANCE_NOTICE}
          </p>
        </div>

        <DashboardMock />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard mockup                                                          */
/* -------------------------------------------------------------------------- */
function DashboardMock() {
  return (
    <div className="relative">
      {/* floating glow ring */}
      <div className="absolute -inset-10 -z-10 rounded-[40px] bg-gradient-to-br from-indigo-500/25 via-violet-500/10 to-transparent blur-3xl" />

      {/* Floating corner badge */}
      <div className="absolute -right-3 -top-3 z-10 hidden rotate-3 rounded-2xl border border-white/10 bg-[#0c1222]/90 px-4 py-3 text-[11px] shadow-2xl backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="uppercase tracking-[0.18em] text-white/45">Live</span>
        </div>
        <p className="mt-1 font-serif text-sm text-white">Audit log synced</p>
      </div>

      <div className="relative rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        {/* gradient rim */}
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />

        {/* window chrome */}
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

        {/* KPI strip */}
        <div className="relative grid grid-cols-3 gap-2">
          {[
            ["Active disputes", "4", "+2 wk"],
            ["Items flagged", "11", "3 high"],
            ["In transit", "2", "certified"],
          ].map(([l, v, d]) => (
            <div
              key={l as string}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/40">{l}</p>
              <p className="mt-1.5 font-serif text-xl text-white">{v}</p>
              <p className="text-[10px] text-emerald-300/85">{d}</p>
            </div>
          ))}
        </div>

        {/* AI insight */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.12] to-violet-500/[0.04] p-4">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative flex items-center gap-2">
            <span className="rounded-md bg-indigo-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
              AI Insight
            </span>
            <span className="text-[10px] text-white/50">just now</span>
          </div>
          <p className="relative mt-2.5 text-[13px] leading-relaxed text-white/90">
            Capital One tradeline shows a balance mismatch across two bureaus.
            <span className="text-white/55"> Recommended: review documentation before disputing.</span>
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

        {/* Timeline */}
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

        {/* Certified mail */}
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
    <section className="relative border-y border-white/5 bg-white/[0.012]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/35">
          Built to the standard of
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[11px] uppercase tracking-[0.22em] text-white/55">
          {items.map((i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              {i}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Principles (why different)                                                */
/* -------------------------------------------------------------------------- */
function Principles() {
  const cards = [
    {
      kicker: "Principle 01",
      title: "Accuracy over speed",
      desc: "Most tools push you to fire off disputes. DisputeIQ helps you act correctly — with a factual basis, every time.",
    },
    {
      kicker: "Principle 02",
      title: "Transparency by design",
      desc: "Every action is logged, timestamped, and exportable. You always know what happened, when, and why.",
    },
    {
      kicker: "Principle 03",
      title: "You stay in control",
      desc: "Nothing is sent to bureaus without your explicit confirmation. No auto-dispatch. No hidden actions.",
    },
    {
      kicker: "Principle 04",
      title: "Institutional security",
      desc: "AES-256 at rest, TLS 1.3 in transit, isolated document vault. We never sell or share your data.",
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
            key={c.title}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-7 transition hover:-translate-y-0.5 hover:border-indigo-400/40 hover:from-indigo-500/[0.08]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-300/90">
              {c.kicker}
            </p>
            <h3 className="mt-5 font-serif text-xl text-white">{c.title}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-white/55">{c.desc}</p>
            <div className="absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Storyline (how it works)                                                  */
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
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-indigo-400/30 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-xl italic text-indigo-300">{s.n}</span>
              {i < 4 && <span className="text-white/20">→</span>}
            </div>
            <h3 className="mt-5 font-serif text-lg text-white">{s.t}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/55">{s.d}</p>
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
          <div className="absolute -inset-8 -z-10 rounded-[36px] bg-gradient-to-br from-indigo-500/25 via-violet-500/10 to-transparent blur-3xl" />
          <div className="relative rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_-4px_rgba(139,92,246,0.6)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-[#0a0f1c]" />
                <div className="absolute inset-0 flex items-center justify-center font-serif text-sm italic text-white/95">
                  D
                </div>
              </div>
              <div>
                <p className="font-serif text-[15px] text-white">DisputeIQ AI</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">
                  Online · reading your file
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-[13px]">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-500/20 px-4 py-2.5 text-white/95">
                Why is my Capital One account flagged?
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3 leading-relaxed text-white/85">
                This account may be inaccurate because two bureaus report different balances —
                <span className="text-indigo-300"> $1,284</span> on Equifax vs
                <span className="text-indigo-300"> $1,402</span> on Experian. The $118 delta is above
                rounding tolerance.
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3 leading-relaxed text-white/85">
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
            <li key={t} className="group flex items-start gap-4 border-l border-white/10 pl-5 transition hover:border-indigo-400/50">
              <div>
                <p className="font-serif text-[17px] text-white">{t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust pillars                                                             */
/* -------------------------------------------------------------------------- */
function TrustPillars() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-10 lg:p-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />

          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-300/90">
                Security & trust
              </p>
              <h2 className="mt-4 font-serif text-[36px] leading-[1.1] tracking-tight text-white sm:text-[44px]">
                Your file is yours.
                <br />
                <span className="italic text-white/85">Always.</span>
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65">
                DisputeIQ is engineered like a financial institution handles its own operations:
                encrypted at rest, isolated by tenant, logged immutably, and never sold or shared
                with third parties.
              </p>
              <ul className="mt-8 grid gap-3 text-[13px] text-white/75 sm:grid-cols-2">
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
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center transition hover:border-indigo-400/40 hover:bg-white/[0.04]"
                >
                  <p className="font-serif text-3xl text-white">{v}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/45">{l}</p>
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
            className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 transition hover:border-indigo-400/30"
          >
            <div className="font-serif text-5xl leading-none text-indigo-400/40">&ldquo;</div>
            <blockquote className="mt-3 flex-1 font-serif text-[17px] leading-[1.5] text-white/90">
              {q.q}
            </blockquote>
            <figcaption className="mt-6 border-t border-white/10 pt-5">
              <p className="text-[13px] font-semibold text-white">{q.a}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/40">{q.r}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */
function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$29",
      cadence: "/month",
      desc: "For people getting their first credit file under control.",
      features: [
        "1 credit report per month",
        "Cross-bureau analyzer",
        "Dispute drafts",
        "Document vault (5 GB)",
        "Email support",
      ],
      highlight: false,
    },
    {
      name: "Professional",
      price: "$79",
      cadence: "/month",
      desc: "Built for active credit work and certified dispatch.",
      features: [
        "4 reports per month",
        "USPS certified mail tracking",
        "AI assistant in-app",
        "Document vault (25 GB)",
        "Priority support",
        "Audit log export",
      ],
      highlight: true,
    },
    {
      name: "Private Office",
      price: "$199",
      cadence: "/month",
      desc: "For families and high-volume credit operations.",
      features: [
        "Unlimited reports",
        "Multi-profile support",
        "Dedicated success manager",
        "API access",
        "White-glove onboarding",
        "Quarterly strategy review",
      ],
      highlight: false,
    },
  ];

  return (
    <Section
      eyebrow="Investment"
      title="Premium tools. Honest pricing."
      subtitle="No hidden fees. No surprise charges. Cancel anytime, export everything."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative flex flex-col overflow-hidden rounded-[22px] border p-8 transition ${
              t.highlight
                ? "border-indigo-400/50 bg-gradient-to-b from-indigo-500/[0.18] via-violet-500/[0.06] to-transparent shadow-[0_40px_120px_-30px_rgba(99,102,241,0.55)]"
                : "border-white/10 bg-white/[0.025] hover:border-white/25"
            }`}
          >
            {t.highlight && (
              <>
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-400/25 blur-3xl" />
                <span className="absolute right-6 top-6 rounded-full border border-indigo-300/30 bg-indigo-400/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
                  Most chosen
                </span>
              </>
            )}

            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
              {t.name}
            </p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-serif text-[52px] leading-none text-white">{t.price}</span>
              <span className="text-[13px] text-white/50">{t.cadence}</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-white/60">{t.desc}</p>

            <ul className="mt-7 flex-1 space-y-3.5 border-t border-white/10 pt-6 text-[13px] text-white/80">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/15 text-[9px] text-indigo-200">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href={`${URLS.app}/sign-up`}
              className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] transition ${
                t.highlight
                  ? "bg-white text-[#0b0f1a] shadow-[0_14px_44px_-12px_rgba(255,255,255,0.55)] hover:scale-[1.015]"
                  : "border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
              }`}
            >
              Get started
            </a>
          </div>
        ))}
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
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-fuchsia-600/10 p-14 text-center lg:p-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/60">
          Private beta · invitation access
        </p>
        <h2 className="mx-auto mt-5 max-w-3xl font-serif text-[40px] leading-[1.05] tracking-tight sm:text-[56px]">
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
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0b0f1a] shadow-[0_18px_60px_-14px_rgba(255,255,255,0.55)] transition hover:scale-[1.015]"
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
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */
function Footer() {
  const cols = [
    {
      t: "Product",
      l: [
        ["How it works", "/how-it-works"],
        ["Pricing", "/pricing"],
        ["Trust center", "/trust-center"],
      ],
    },
    {
      t: "Company",
      l: [
        ["About", "/trust-center"],
        ["Method", "/how-it-works"],
        ["Contact", "mailto:support@disputeiq.org"],
      ],
    },
    {
      t: "Legal",
      l: [
        ["Privacy", "/trust-center"],
        ["Terms", "/trust-center"],
        ["Compliance", "/trust-center"],
      ],
    },
  ];
  return (
    <footer className="relative border-t border-white/5 bg-[#06090f]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_-4px_rgba(139,92,246,0.6)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-[#06090f]" />
                <div className="absolute inset-0 flex items-center justify-center font-serif text-sm italic text-white">
                  D
                </div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-serif text-base font-semibold tracking-tight text-white">
                  DisputeIQ
                </span>
                <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-white/40">
                  Audit-grade credit operations
                </span>
              </div>
            </Link>
            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/50">
              The executive workspace for reviewing credit reports, preparing dispute documents, and
              tracking certified mailings — with audit-grade trust built into every step.
            </p>
            <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-white/35">
              {BRAND_FOOTER}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.t}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                  {c.t}
                </p>
                <ul className="mt-5 space-y-3 text-[13px] text-white/70">
                  {c.l.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith("mailto") || href.startsWith("http") ? (
                        <a href={href} className="transition hover:text-white">
                          {label}
                        </a>
                      ) : (
                        <Link href={href} className="transition hover:text-white">
                          {label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-8 text-[11px] text-white/40 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DisputeIQ — disputeiq.org</p>
          <p className="max-w-xl text-[10px] leading-relaxed">
            You may dispute inaccuracies yourself, for free, directly with the bureaus. DisputeIQ is a
            software and workflow tool. We do not guarantee removals or score changes.
          </p>
        </div>
      </div>
    </footer>
  );
}

const BRAND_FOOTER = "Made in the United States · Audit-grade by design";

/* -------------------------------------------------------------------------- */
/*  Section wrapper                                                           */
/* -------------------------------------------------------------------------- */
function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-14 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-300/90">
          {eyebrow}
        </p>
        <h2 className="mt-5 font-serif text-[36px] leading-[1.08] tracking-tight text-white sm:text-[48px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/60">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
