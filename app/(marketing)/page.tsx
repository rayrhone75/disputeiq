import Link from "next/link";
import { COMPLIANCE_NOTICE } from "@/lib/compliance";
import { URLS } from "@/lib/urls";
import { Section } from "@/components/marketing/Section";
import { MSIQ, buildMsiqEnrollUrl } from "@/lib/integrations/myscoreiq";
import { TrustSection } from "@/components/marketing/TrustSection";
import { LeadCaptureForm } from "@/components/marketing/LeadCaptureForm";

/* ----------------------------------------------------------------------------
 * DisputeIQ — premium marketing homepage.
 * Positioning: identify · challenge · track · escalate.
 * Primary funnel entry: MyScoreIQ 3-bureau report intake.
 *
 * The marketing homepage uses env-backed MyScoreIQ defaults (not the
 * DB-managed setting) so it can stay purely static / cached. The
 * authenticated dashboard get-report flow loads the live admin setting
 * instead.
 * -------------------------------------------------------------------------- */

const MSIQ_BASE =
  process.env.MYSCOREIQ_AFFILIATE_URL ??
  process.env.NEXT_PUBLIC_MYSCOREIQ_AFFILIATE_URL ??
  "https://gcpstage.myscoreiq.com/get-fico-preferred.aspx?offercode=432500C3";
const msiqHome = buildMsiqEnrollUrl({
  baseUrl: MSIQ_BASE,
  campaign: "home_hero",
  source: "disputeiq",
});
const msiqStart = buildMsiqEnrollUrl({
  baseUrl: MSIQ_BASE,
  campaign: "home_start_step",
  source: "disputeiq",
});

export default function HomePage() {
  return (
    <>
      <Hero />
      <PressStrip />
      <StartHere />
      <Positioning />
      <DarkProof />
      <Storyline />
      <AISuite />
      <ProductFrames />
      <Coexistence />
      <Testimonials />
      <TrustSection />
      <section className="border-t border-border bg-surface py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Get a free credit analysis preview</h2>
          <p className="mt-2 text-sm text-fg/65">
            We'll email you the next steps for your situation. No spam — ever.
          </p>
          <div className="mt-6">
            <LeadCaptureForm source="homepage" />
          </div>
        </div>
      </section>
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
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-fg-muted backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
            </span>
            A Screwed Up Credit company
          </span>

          <h1 className="mt-7 font-serif text-[56px] font-medium leading-[1.02] tracking-[-0.02em] text-fg sm:text-[74px]">
            Identify. Challenge.
            <br />
            <span className="italic">
              Track.{" "}
              <span className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 bg-clip-text text-transparent">
                Escalate.
              </span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-[1.65] text-fg-muted">
            DisputeIQ is the executive-grade credit action platform. Turn a real 3-bureau report
            into a disciplined workflow of disputes, certified mailings, fraud blocks, and CFPB
            escalations — with audit-grade trust in every step.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/get-started"
              className="group inline-flex items-center gap-2 rounded-xl bg-fg px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-canvas shadow-[0_14px_40px_-14px_rgba(10,15,28,0.6)] transition hover:scale-[1.015] hover:bg-fg/90"
            >
              Start your file
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface/70 px-7 py-3.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-fg transition hover:border-fg hover:bg-surface"
            >
              See the method
            </Link>
          </div>

          <dl className="mt-14 grid max-w-xl grid-cols-4 gap-5 border-t border-border-strong pt-8">
            {[
              ["Identify", "Cross-bureau diffs"],
              ["Challenge", "Factual disputes"],
              ["Track", "Certified mail"],
              ["Escalate", "605B · CFPB"],
            ].map(([v, l]) => (
              <div key={v as string}>
                <dt className="font-serif text-[20px] text-fg">{v}</dt>
                <dd className="mt-1 text-[10px] uppercase tracking-[0.16em] text-fg-subtle">{l}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-xl text-[11px] leading-relaxed text-fg-subtle">
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
      <div className="absolute -inset-10 -z-10 rounded-[40px] bg-gradient-to-br from-indigo-200/70 via-violet-200/50 to-transparent blur-3xl" />

      <div className="absolute -right-3 -top-3 z-10 hidden rotate-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 text-[11px] shadow-[0_20px_50px_-20px_rgba(10,15,28,0.3)] backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="uppercase tracking-[0.18em] text-fg-subtle">Live</span>
        </div>
        <p className="mt-1 font-serif text-sm text-fg">Audit log synced</p>
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
            ["Identified", "11", "3 high"],
            ["Challenged", "4", "in flight"],
            ["Escalations", "1", "605B"],
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
            Capital One tradeline shows a $118 balance mismatch between Equifax and Experian.
            <span className="text-white/60"> Strongest next action: factual dispute.</span>
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
              ["Report pulled via MyScoreIQ", "now", "bg-indigo-400"],
              ["Cross-bureau audit complete", "1m", "bg-violet-400"],
              ["Letter mailed via USPS certified", "1h", "bg-emerald-400"],
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
    "FCRA-literate",
    "No data sales",
  ];
  return (
    <section className="relative border-y border-border bg-surface/60">
      <div className="mx-auto max-w-7xl px-6 py-9">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-fg-subtle">
          Built to the standard of
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[11px] uppercase tracking-[0.22em] text-fg-muted">
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
/*  Start Here — MyScoreIQ funnel entry                                        */
/* -------------------------------------------------------------------------- */
function StartHere() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Start here
          </p>
          <h2 className="mt-5 font-serif text-[36px] leading-[1.08] tracking-tight text-fg sm:text-[48px]">
            Start with your real 3-bureau credit file.
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            You can't challenge what you can't see. Every DisputeIQ workflow begins with a live
            3-bureau report pulled through our supported provider,{" "}
            <span className="font-semibold text-fg">MyScoreIQ</span>.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* Primary CTA card */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/5 bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] p-10 text-white shadow-[0_40px_120px_-32px_rgba(79,70,229,0.45)] lg:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />

            <div className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-300">
                Step 01 · Report intake
              </p>
              <h3 className="mt-4 font-serif text-[32px] leading-[1.1] tracking-tight sm:text-[40px]">
                Pull your 3-bureau file
                <br />
                <span className="italic text-white/85">in under two minutes.</span>
              </h3>
              <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-white/70">
                MyScoreIQ delivers live Experian, Equifax, and TransUnion data so DisputeIQ
                can run its cross-bureau analysis the moment your file lands.
              </p>

              <ul className="mt-7 grid gap-2.5 text-[13px] text-white/85 sm:grid-cols-2">
                {[
                  "Live tri-merge report",
                  "Experian · Equifax · TransUnion",
                  "Refresh on demand",
                  "Import directly into DisputeIQ",
                ].map((l) => (
                  <li key={l} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {l}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href={msiqHome}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg shadow-[0_18px_60px_-16px_rgba(255,255,255,0.55)] transition hover:scale-[1.015]"
                >
                  Start with {MSIQ.productName} →
                </a>
                <Link
                  href="/get-started"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
                >
                  See all 3 steps
                </Link>
              </div>

              <p className="mt-7 text-[11px] leading-relaxed text-white/45">
                MyScoreIQ is the supported report provider for DisputeIQ. DisputeIQ is a
                workflow tool — we do not sell credit monitoring.
              </p>
            </div>
          </div>

          {/* Steps card */}
          <div className="rounded-[24px] border border-border bg-surface p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
              The three-step intake
            </p>
            <h3 className="mt-4 font-serif text-[26px] leading-tight text-fg">
              From report to action in three steps.
            </h3>
            <ol className="mt-7 space-y-6">
              {[
                {
                  n: "01",
                  t: "Get your report",
                  d: "Activate MyScoreIQ and pull your live 3-bureau file.",
                },
                {
                  n: "02",
                  t: "Return to DisputeIQ",
                  d: "Come back to disputeiq.org to open your command center.",
                },
                {
                  n: "03",
                  t: "Connect & analyze",
                  d: "Connect your MyScoreIQ report. AI cross-bureau analysis surfaces actionable findings.",
                },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted font-mono text-[11px] font-semibold text-indigo-700">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-serif text-[17px] text-fg">{s.t}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 border-t border-border pt-6">
              <a
                href={msiqStart}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fg bg-fg px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-canvas transition hover:bg-fg/90"
              >
                Start with MyScoreIQ →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Positioning — identify · challenge · track · escalate                     */
/* -------------------------------------------------------------------------- */
function Positioning() {
  const cards = [
    {
      k: "01 · Identify",
      t: "See what's actually wrong.",
      d: "Cross-bureau diffs flag balance, status, date, and ownership inconsistencies — ranked by severity and explained in plain English.",
    },
    {
      k: "02 · Challenge",
      t: "Act with factual precision.",
      d: "Server-side document generation drafts factual disputes from the real report — no fabricated claims, no boilerplate.",
    },
    {
      k: "03 · Track",
      t: "Watch every packet land.",
      d: "USPS certified mail with electronic return receipts. Delivery scans and bureau responses sync into your timeline.",
    },
    {
      k: "04 · Escalate",
      t: "Stronger actions when warranted.",
      d: "Section 605B fraud blocks and CFPB complaint drafts are built-in for cases that demand escalation, not another soft letter.",
    },
  ];
  return (
    <Section
      eyebrow="The DisputeIQ method"
      title="Four disciplines. One command center."
      subtitle="DisputeIQ is not a report viewer. It's a credit action platform — designed to turn your file into disciplined, documented, verifiable steps."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.t}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-[0_1px_0_0_rgba(10,15,28,0.04),0_28px_50px_-22px_rgba(79,70,229,0.28)]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-600">{c.k}</p>
            <h3 className="mt-5 font-serif text-[22px] text-fg">{c.t}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{c.d}</p>
            <div className="absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dark proof — security pillars                                             */
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
                encrypted at rest, isolated by tenant, logged immutably, never sold or shared with
                third parties.
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
    { n: "I", t: "Upload", d: "Drop your tri-merge PDF. Encrypted on upload and stored in an isolated vault keyed to you alone." },
    { n: "II", t: "Analyze", d: "Cross-bureau diffing surfaces balance, status, date, and ownership inconsistencies — ranked by severity." },
    { n: "III", t: "Prepare", d: "Factual dispute documents are drafted server-side and held until your review. Nothing auto-sends." },
    { n: "IV", t: "Dispatch", d: "Print and mail yourself, or dispatch through our USPS certified mail integration with return receipts." },
    { n: "V", t: "Escalate", d: "605B fraud blocks and CFPB drafts are ready the moment a standard dispute isn't enough." },
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
            className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:-translate-y-0.5 hover:border-indigo-500/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-[22px] italic text-indigo-600">{s.n}</span>
              {i < 4 && <span className="text-fg-subtle">→</span>}
            </div>
            <h3 className="mt-5 font-serif text-[18px] text-fg">{s.t}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI Suite — major product differentiator                                   */
/* -------------------------------------------------------------------------- */
function AISuite() {
  return (
    <Section
      eyebrow="DisputeIQ AI"
      title="An assistant that reads the fine print for you."
      subtitle="Ask anything about your file. Understand the findings. Draft letters from real report facts. Escalate with confidence."
    >
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="relative">
          <div className="absolute -inset-8 -z-10 rounded-[36px] bg-gradient-to-br from-indigo-200/70 via-violet-200/50 to-transparent blur-3xl" />
          <div className="relative rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0e1424] to-[#0a0f1c] p-6 text-white shadow-[0_50px_120px_-30px_rgba(10,15,28,0.45)]">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 shadow-[0_0_28px_-4px_rgba(139,92,246,0.6)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-surface-strong" />
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
                <span className="text-emerald-300">Next best action:</span> a factual dispute to both
                bureaus citing the balance discrepancy. I can draft it from the actual report facts
                for your review.
              </div>
            </div>
          </div>
        </div>

        <ul className="space-y-6">
          {[
            ["Reads your report", "Pulls real facts from your tri-merge so every recommendation is grounded in the file."],
            ["Drafts letters from facts", "Factual dispute language built from the actual tradelines — no boilerplate, no invented claims."],
            ["Recommends the next action", "Standard dispute, 605B fraud block, or CFPB escalation — ranked by impact and evidence."],
            ["Identifies missing documents", "Knows what evidence each escalation type requires before you send."],
            ["Summarizes tracking events", "Plain-English status updates on certified mail, bureau responses, and deadlines."],
          ].map(([t, d]) => (
            <li key={t} className="group flex items-start gap-4 border-l-2 border-border-strong pl-5 transition hover:border-indigo-600">
              <div>
                <p className="font-serif text-[18px] text-fg">{t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Product Frames — five concrete views of the operational product           */
/* -------------------------------------------------------------------------- */
function ProductFrames() {
  return (
    <section className="relative bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Inside the product
          </p>
          <h2 className="mt-5 font-serif text-[36px] leading-[1.08] tracking-tight text-fg sm:text-[48px]">
            Five views. One operational record.
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            Every dispute is tracked across five connected surfaces — from the parsed tri-merge to
            the escalation panel. This is what you actually see.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FrameTriMerge />
          <FrameProofVault />
          <FrameVerdictCard />
          <FrameTrackingTimeline />
          <FrameEscalationStages />
        </div>
      </div>
    </section>
  );
}

function FrameShell({
  eyebrow,
  title,
  children,
  wide,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-border bg-surface-muted p-5 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-28px_rgba(10,15,28,0.14)] ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-fg-subtle">
          {eyebrow}
        </p>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </div>
      <h3 className="mb-3 font-serif text-[18px] leading-tight tracking-tight text-fg">
        {title}
      </h3>
      <div className="rounded-xl border border-border-strong bg-surface p-4 text-[11px] text-fg">
        {children}
      </div>
    </article>
  );
}

function FrameTriMerge() {
  const row = (creditor: string, eq: string, ex: string, tu: string, flag?: boolean) => (
    <tr className={flag ? "bg-rose-50/70" : ""}>
      <td className="py-1.5 pr-2 font-semibold text-fg">{creditor}</td>
      <td className="px-2 text-center tabular-nums">{eq}</td>
      <td className="px-2 text-center tabular-nums">{ex}</td>
      <td className="px-2 text-center tabular-nums">{tu}</td>
    </tr>
  );
  return (
    <FrameShell eyebrow="I. Import" title="Tri-merge parse">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border-strong text-[9px] uppercase tracking-[0.14em] text-fg-subtle">
            <th className="py-1 pr-2 text-left">Creditor</th>
            <th className="px-2">EQ</th>
            <th className="px-2">EX</th>
            <th className="px-2">TU</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {row("Capital One", "$1,284", "$1,402", "$1,284", true)}
          {row("Discover", "$0", "$0", "$0")}
          {row("Midland Funding", "$412", "$412", "—")}
          {row("JPMC Auto", "Closed", "Closed", "Open", true)}
        </tbody>
      </table>
      <p className="mt-3 border-t border-border-subtle pt-2 text-[10px] text-fg-subtle">
        2 cross-bureau inconsistencies flagged · column parser confidence: high
      </p>
    </FrameShell>
  );
}

function FrameProofVault() {
  const items = [
    { c: "Capital One", b: "Equifax", v: "stall", tone: "bg-amber-100 text-amber-700" },
    { c: "Midland", b: "Experian", v: "deleted", tone: "bg-emerald-100 text-emerald-700" },
    { c: "Discover", b: "TransUnion", v: "verified", tone: "bg-rose-100 text-rose-700" },
  ];
  return (
    <FrameShell eyebrow="VI. Vault" title="Proof Vault">
      <ul className="space-y-2">
        {items.map((i) => (
          <li
            key={i.c}
            className="flex items-center justify-between rounded-lg border border-border-subtle p-2.5"
          >
            <div>
              <p className="font-semibold text-fg">{i.c}</p>
              <p className="text-[10px] text-fg-subtle">{i.b} response · PDF filed</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${i.tone}`}
            >
              {i.v}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-fg-subtle">
        Every response parsed · linked to its dispute · one click to escalate
      </p>
    </FrameShell>
  );
}

function FrameVerdictCard() {
  return (
    <FrameShell eyebrow="VI. Response parser" title="AI verdict">
      <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-700">
            Verdict
          </p>
          <span className="rounded-full bg-surface/80 px-2 py-0.5 text-[9px] font-semibold uppercase text-fg ring-1 ring-border-strong">
            Next: re-dispute (MOV)
          </span>
        </div>
        <p className="mt-1 font-semibold text-fg">Stall tactic</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
          Bureau requested additional ID documentation beyond what §1681i requires. This is a
          recognized stall pattern.
        </p>
        <p className="mt-2 border-l-2 border-amber-300 pl-2 text-[10px] italic text-fg-subtle">
          AI reasoning: Response cites 'frivolous' but provides no substantive basis.
        </p>
      </div>
    </FrameShell>
  );
}

function FrameTrackingTimeline() {
  const events = [
    { t: "Printed by LetterStream", ts: "Tue 9:12a", tone: "bg-indigo-400" },
    { t: "Accepted at USPS origin", ts: "Tue 4:48p", tone: "bg-indigo-400" },
    { t: "In transit · Memphis", ts: "Wed 7:02a", tone: "bg-violet-400" },
    { t: "Delivered · signature on file", ts: "Fri 10:31a", tone: "bg-emerald-400" },
    { t: "FCRA 30-day clock started", ts: "Fri 10:31a", tone: "bg-emerald-400" },
  ];
  return (
    <FrameShell eyebrow="V. Tracking" title="Certified mail timeline">
      <ol className="space-y-2">
        {events.map((e) => (
          <li key={e.t} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${e.tone}`} />
              {e.t}
            </span>
            <span className="font-mono text-[10px] text-fg-subtle">{e.ts}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-border-subtle pt-2 text-[10px] text-fg-subtle">
        USPS 9214-8901-2347-3318 · auto follow-up on Apr 30
      </p>
    </FrameShell>
  );
}

function FrameEscalationStages() {
  const stages = [
    { n: "1", t: "Re-dispute", sub: "FCRA §611 round 2", active: false, done: true },
    { n: "2", t: "MOV demand", sub: "Method of Verification", active: true, done: false },
    { n: "3", t: "CFPB complaint", sub: "Consent order record", active: false, done: false },
    { n: "4", t: "§623(b) furnisher", sub: "Direct to creditor", active: false, done: false },
  ];
  return (
    <FrameShell eyebrow="VII. Escalation" title="Four stages, one ladder" wide>
      <div className="grid gap-2 sm:grid-cols-4">
        {stages.map((s) => (
          <div
            key={s.n}
            className={`rounded-lg border p-3 ${
              s.active
                ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                : s.done
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-border-subtle bg-surface-muted"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                  s.done
                    ? "bg-emerald-600 text-white"
                    : s.active
                      ? "bg-indigo-600 text-white"
                      : "bg-border text-fg-subtle"
                }`}
              >
                {s.done ? "✓" : s.n}
              </span>
              {s.active && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600">
                  Active
                </span>
              )}
            </div>
            <p className="mt-2 font-semibold text-fg">{s.t}</p>
            <p className="text-[10px] text-fg-subtle">{s.sub}</p>
          </div>
        ))}
      </div>
    </FrameShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coexistence — DisputeIQ + Screwed Up Credit explainer                     */
/* -------------------------------------------------------------------------- */
function Coexistence() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[24px] border border-border bg-surface-muted p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03)] lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
                About our ecosystem
              </p>
              <h2 className="mt-5 font-serif text-[32px] leading-[1.1] tracking-tight text-fg sm:text-[40px]">
                DisputeIQ is a{" "}
                <span className="italic">Screwed Up Credit</span> company.
              </h2>
              <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-fg-muted">
                Screwed Up Credit is the parent ecosystem for our credit operations tooling.
                DisputeIQ is the executive-grade action platform. MyScoreIQ is the
                supported provider we use for live 3-bureau report intake.
              </p>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-fg-muted">
                When you start through MyScoreIQ from our homepage, you&apos;re starting
                the Screwed Up Credit customer journey that ends in your DisputeIQ command
                center.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                {
                  h: "DisputeIQ",
                  s: "Credit action platform",
                  d: "Identify, challenge, track, escalate — your primary workspace.",
                },
                {
                  h: "MyScoreIQ",
                  s: "Supported report provider",
                  d: "Live 3-bureau report pulls used across the Screwed Up Credit journey.",
                },
                {
                  h: "Screwed Up Credit",
                  s: "Parent ecosystem",
                  d: "The umbrella brand that ties the customer journey together.",
                },
              ].map((b) => (
                <div
                  key={b.h}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_0_0_rgba(10,15,28,0.03)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-[17px] text-fg">{b.h}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-fg-subtle">
                      {b.s}
                    </p>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{b.d}</p>
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
            className="relative flex h-full flex-col rounded-2xl border border-border bg-surface p-8 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_20px_40px_-24px_rgba(10,15,28,0.12)] transition hover:border-indigo-500/40"
          >
            <div className="font-serif text-5xl leading-none text-indigo-600/30">&ldquo;</div>
            <blockquote className="mt-3 flex-1 font-serif text-[18px] leading-[1.5] text-fg">
              {q.q}
            </blockquote>
            <figcaption className="mt-6 border-t border-border pt-5">
              <p className="text-[13px] font-semibold text-fg">{q.a}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-fg-subtle">{q.r}</p>
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
      eyebrow="Simple pricing"
      title="Powerful DIY credit repair tools without confusing per-item pricing"
      subtitle="Connect your required credit monitoring, choose your monthly plan, and send dispute packets with AI-powered guidance and built-in mailing."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { name: "Starter", price: "$69/mo", packets: "1 packet/mo" },
          { name: "Pro", price: "$99/mo", packets: "3 packets/mo", featured: true },
          { name: "Elite", price: "$129/mo", packets: "5 packets/mo" },
        ].map((p) => (
          <div
            key={p.name}
            className={`rounded-2xl border p-6 ${p.featured ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-200" : "border-border bg-surface"}`}
          >
            <p className="text-2xl font-bold text-fg">{p.price}</p>
            <p className="mt-1 text-base font-semibold text-fg">{p.name}</p>
            <p className="mt-2 text-sm text-fg-muted">{p.packets} · AI drafting · certified mail</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-fg-muted">
          Extra packets $19.95 each · MyScoreIQ billed separately · Not charged per item
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-xl bg-fg px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-canvas shadow-[0_14px_40px_-14px_rgba(10,15,28,0.6)] transition hover:scale-[1.015] hover:bg-fg/90"
        >
          See plans and packet limits →
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
            A Screwed Up Credit company
          </p>
          <h2 className="mx-auto mt-5 max-w-3xl font-serif text-[42px] leading-[1.05] tracking-tight sm:text-[58px]">
            Identify. Challenge. Track.
            <br />
            <span className="italic text-white/85">Escalate.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
            Start by pulling your live 3-bureau report. Return to DisputeIQ to turn it into action.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg shadow-[0_18px_60px_-14px_rgba(255,255,255,0.55)] transition hover:scale-[1.015]"
            >
              Start your file →
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
