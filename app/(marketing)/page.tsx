import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";
import { URLS } from "@/lib/urls";

/* ----------------------------------------------------------------------------
 * DisputeIQ — premium dark marketing homepage.
 * Self-contained Tailwind. Avoids the legacy light-theme primitives.
 * -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden bg-[#070a14] text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.25),transparent)] blur-2xl" />
        <div className="absolute right-[-10%] top-[40%] h-[500px] w-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.18),transparent)] blur-3xl" />
        <div className="absolute left-[-10%] top-[70%] h-[400px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.10),transparent)] blur-3xl" />
      </div>

      <Topbar />
      <Hero />
      <TrustStrip />
      <WhyDifferent />
      <HowItWorks />
      <AISection />
      <ProductModules />
      <Security />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Topbar                                                                    */
/* -------------------------------------------------------------------------- */
function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070a14]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_20px_-2px_rgba(139,92,246,0.5)]" />
          <span className="font-semibold tracking-tight">DisputeIQ</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
          <Link href="/how-it-works" className="hover:text-white">How it works</Link>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <Link href="/trust-center" className="hover:text-white">Trust center</Link>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={`${URLS.app}/sign-in`}
            className="rounded-xl px-3 py-2 text-sm font-medium text-white/80 hover:text-white"
          >
            Sign in
          </a>
          <a
            href={`${URLS.app}/sign-up`}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0b0f1a] shadow-[0_8px_30px_-8px_rgba(255,255,255,0.4)] hover:bg-white/90"
          >
            Open the portal
          </a>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — headline + dashboard mockup                                        */
/* -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-28">
        {/* Left: copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Audit-grade credit operations
          </span>
          <h1 className="mt-6 font-semibold leading-[1.05] tracking-tight text-white text-5xl sm:text-6xl">
            Take control of your credit{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              with precision.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
            Review reports. Identify potential inaccuracies. Prepare dispute documents. Track certified mail.
            All from one secure, audit-grade command center.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={`${URLS.app}/sign-up`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0b0f1a] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] transition hover:scale-[1.02] hover:bg-white/95"
            >
              Open Your Portal →
            </a>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30 hover:bg-white/[0.07]"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
            <Badge>Bank-level encryption</Badge>
            <Badge>Audit-grade tracking</Badge>
            <Badge>Certified mail</Badge>
            <Badge>AI-guided workflow</Badge>
          </div>

          <p className="mt-6 max-w-xl text-[11px] leading-relaxed text-white/35">{COMPLIANCE_NOTICE}</p>
        </div>

        {/* Right: dashboard mockup */}
        <DashboardMock />
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-white/40" />
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard mockup — multi-layer visual proof                               */
/* -------------------------------------------------------------------------- */
function DashboardMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent blur-2xl" />
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        {/* window chrome */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/40">DisputeIQ · Command Center</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Active disputes", "4", "+2 wk"],
            ["Items flagged", "11", "3 high"],
            ["In flight", "2", "certified"],
          ].map(([l, v, d]) => (
            <div key={l} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[9px] uppercase tracking-widest text-white/40">{l}</p>
              <p className="mt-1 font-semibold text-white">{v}</p>
              <p className="text-[10px] text-emerald-300/80">{d}</p>
            </div>
          ))}
        </div>

        {/* AI insight */}
        <div className="mt-4 rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-200">
              AI Insight
            </span>
            <span className="text-[10px] text-white/50">just now</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            Capital One tradeline shows a balance mismatch across two bureaus.
            <span className="text-white/60"> Recommended: review documentation before disputing.</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              Dispute Ready
            </span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60">
              Equifax · Experian
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Activity timeline</p>
          <ol className="mt-2 space-y-2">
            {[
              ["Cross-bureau audit complete", "now", "bg-indigo-400"],
              ["Letter mailed via USPS certified", "1h", "bg-emerald-400"],
              ["Report ingested", "3h", "bg-white/40"],
            ].map(([t, ts, dot]) => (
              <li key={t} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-white/80">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  {t}
                </span>
                <span className="text-white/40">{ts}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Certified mail */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-white/80">USPS 9214-8901-2347-3318</span>
          </div>
          <span className="text-white/50">In transit · ETA Wed</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust strip                                                               */
/* -------------------------------------------------------------------------- */
function TrustStrip() {
  const items = [
    "AES-256 encryption",
    "SOC 2-aligned controls",
    "Audit-grade activity log",
    "Certified mail tracking",
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-6 px-6 py-6 text-xs uppercase tracking-widest text-white/45">
        {items.map((i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Why different                                                             */
/* -------------------------------------------------------------------------- */
function WhyDifferent() {
  const cards = [
    {
      title: "Audit-grade tracking",
      desc: "Every action logged, timestamped, and exportable. You see exactly what happened, when, and why.",
    },
    {
      title: "Bank-level security",
      desc: "AES-256 encryption at rest, isolated document vault, and zero third-party data sharing.",
    },
    {
      title: "Certified mail tracking",
      desc: "Letters dispatch via USPS certified mail with electronic return receipts synced to your timeline.",
    },
    {
      title: "AI-guided workflow",
      desc: "Understand what matters, what to do next, and what to ignore — without guessing.",
    },
  ];
  return (
    <Section
      eyebrow="Why DisputeIQ"
      title="Built for accuracy, control, and transparency."
      subtitle="Most credit tools push you to act fast. DisputeIQ helps you act correctly."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 transition hover:border-indigo-400/30 hover:from-indigo-500/10"
          >
            <div className="mb-5 h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]" />
            <h3 className="font-semibold text-white">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{c.desc}</p>
            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  How it works                                                              */
/* -------------------------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    { n: "01", t: "Upload your credit report", d: "Drop your PDF report. It's encrypted on upload and stored in an isolated vault." },
    { n: "02", t: "AI analyzes & flags issues", d: "Cross-bureau diffing surfaces balance, status, date, and ownership inconsistencies." },
    { n: "03", t: "Review & prepare disputes", d: "Pre-drafted, factual dispute documents wait for your confirmation. Nothing auto-sends." },
    { n: "04", t: "Send via certified mail", d: "Print and mail yourself, or dispatch through our certified mail integration." },
    { n: "05", t: "Track every update", d: "Delivery scans, response letters, and follow-ups all sync into your timeline." },
  ];
  return (
    <Section eyebrow="How it works" title="Five steps. Total transparency." subtitle="No black box. No hidden actions. You confirm everything.">
      <div className="grid gap-4 lg:grid-cols-5">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="relative rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300">{s.n}</span>
              {i < 4 && <span className="text-white/20">→</span>}
            </div>
            <h3 className="mt-4 text-sm font-semibold text-white">{s.t}</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/55">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI section                                                                */
/* -------------------------------------------------------------------------- */
function AISection() {
  return (
    <Section
      eyebrow="DisputeIQ AI"
      title="Your credit assistant, built into every step."
      subtitle="Ask anything. Understand everything. Move forward with confidence."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        {/* Mock chat */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent blur-2xl" />
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-5 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600" />
              <div>
                <p className="text-sm font-semibold">DisputeIQ AI</p>
                <p className="text-[10px] uppercase tracking-widest text-emerald-300/80">Online</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-500/20 p-3 text-white/90">
                Why is my Capital One account flagged?
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] p-3 text-white/85">
                This account may be inaccurate because two bureaus report different balances —
                <span className="text-indigo-300"> $1,284</span> on Equifax vs
                <span className="text-indigo-300"> $1,402</span> on Experian.
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] p-3 text-white/85">
                <span className="text-emerald-300">Next step:</span> review your last statement to confirm the
                correct balance, then prepare a factual dispute.
              </div>
            </div>
          </div>
        </div>

        {/* Bullets */}
        <ul className="space-y-5">
          {[
            ["Explains flagged accounts", "Plain-English breakdowns of why something is suspicious."],
            ["Suggests next actions", "Actionable next steps, ranked by impact and effort."],
            ["Identifies missing documents", "Knows what evidence each dispute type requires."],
            ["Tracks dispute progress", "Surfaces status changes, delivery scans, and bureau responses."],
            ["Simplifies complex reports", "Turns 60-page tri-merge reports into a clear action list."],
          ].map(([t, d]) => (
            <li key={t} className="flex items-start gap-4">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-400/30 bg-indigo-500/15 text-xs text-indigo-200">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t}</p>
                <p className="mt-1 text-sm text-white/55">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Product modules                                                           */
/* -------------------------------------------------------------------------- */
function ProductModules() {
  const mods = [
    "Credit Report Analyzer",
    "Dispute Builder",
    "Document Vault",
    "Certified Mail Tracker",
    "Activity Timeline",
    "AI Assistant",
  ];
  return (
    <Section
      eyebrow="The system"
      title="Everything you need in one platform."
      subtitle="Six tightly integrated modules. One source of truth."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mods.map((m, i) => (
          <div
            key={m}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.05]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400/20 to-violet-500/10 text-sm font-semibold text-indigo-200">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <p className="font-semibold text-white">{m}</p>
              <p className="text-xs text-white/45">Integrated · Audited · Secure</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Security section                                                          */
/* -------------------------------------------------------------------------- */
function Security() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300">Security & trust</span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Your file is yours. Always.
              </h2>
              <p className="mt-4 max-w-xl text-white/65">
                DisputeIQ is built like a financial institution handles its own operations: encrypted at rest,
                isolated by tenant, logged immutably, never sold or shared.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/75">
                {[
                  "AES-256 encryption at rest, TLS 1.3 in transit",
                  "Per-tenant data isolation & vaulted documents",
                  "No third-party data brokers — ever",
                  "Full activity log, exportable on demand",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["AES-256", "Encryption"],
                ["TLS 1.3", "Transport"],
                ["SOC 2", "Aligned"],
                ["Zero", "Data sales"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"
                >
                  <p className="text-2xl font-semibold text-white">{v}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-white/45">{l}</p>
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
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */
function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$29",
      cadence: "/mo",
      desc: "For people getting their first credit file under control.",
      features: ["1 credit report / month", "Cross-bureau analyzer", "Dispute drafts", "Email support"],
      highlight: false,
    },
    {
      name: "Pro",
      price: "$79",
      cadence: "/mo",
      desc: "Most chosen. Built for active credit work and certified mail.",
      features: [
        "4 reports / month",
        "Certified mail tracking",
        "AI assistant in-app",
        "Document vault",
        "Priority support",
      ],
      highlight: true,
    },
    {
      name: "Elite",
      price: "$199",
      cadence: "/mo",
      desc: "For families and high-volume credit operations.",
      features: [
        "Unlimited reports",
        "Multi-profile support",
        "Dedicated success manager",
        "API access",
        "White-glove onboarding",
      ],
      highlight: false,
    },
  ];

  return (
    <Section
      eyebrow="Pricing"
      title="Premium tools. Honest pricing."
      subtitle="No hidden fees. No surprise charges. Cancel any time."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative overflow-hidden rounded-2xl border p-7 transition ${
              t.highlight
                ? "border-indigo-400/40 bg-gradient-to-br from-indigo-500/15 via-violet-500/5 to-transparent shadow-[0_30px_80px_-30px_rgba(99,102,241,0.5)]"
                : "border-white/10 bg-white/[0.025] hover:border-white/20"
            }`}
          >
            {t.highlight && (
              <span className="absolute right-5 top-5 rounded-full bg-indigo-400/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-200">
                Most popular
              </span>
            )}
            <p className="text-sm font-semibold text-white/80">{t.name}</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-white">{t.price}</span>
              <span className="text-sm text-white/50">{t.cadence}</span>
            </div>
            <p className="mt-3 text-sm text-white/60">{t.desc}</p>
            <ul className="mt-6 space-y-3 text-sm text-white/75">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-indigo-300">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={`${URLS.app}/sign-up`}
              className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                t.highlight
                  ? "bg-white text-[#0b0f1a] hover:bg-white/90"
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
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-fuchsia-600/10 p-12 text-center lg:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(closest-side,rgba(139,92,246,0.3),transparent)]" />
        <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Take control of your credit today.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/70">
          Open your portal in minutes. Cancel any time. No bureau contact happens without your explicit confirmation.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`${URLS.app}/sign-up`}
            className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[#0b0f1a] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)] transition hover:scale-[1.02]"
          >
            Open Your Portal
          </a>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            See How It Works
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
  return (
    <footer className="border-t border-white/5 bg-[#06090f]">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 text-xs text-white/40 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} DisputeIQ — disputeiq.org</p>
        <div className="flex gap-6">
          <Link href="/trust-center" className="hover:text-white">Trust center</Link>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <a href="mailto:support@disputeiq.org" className="hover:text-white">support@disputeiq.org</a>
        </div>
      </div>
    </footer>
  );
}

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
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-12 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-300">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-3 text-white/55">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
