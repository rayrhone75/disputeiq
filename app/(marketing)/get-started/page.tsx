import Link from "next/link";
import { URLS } from "@/lib/urls";
import { IDIQ, buildIdiqEnrollUrl } from "@/lib/integrations/identityiq";

export const metadata = {
  title: "Get started — DisputeIQ",
  description:
    "Three steps to turn your live 3-bureau IdentityIQ report into disciplined credit action: get your report, return to DisputeIQ, import and begin analysis.",
};

const IDIQ_BASE =
  process.env.IDIQ_AFFILIATE_URL ??
  process.env.NEXT_PUBLIC_IDIQ_AFFILIATE_URL ??
  "https://www.identityiq.com/securepreferred.aspx?offercode=431298HW";
const idiqLink = buildIdiqEnrollUrl({
  baseUrl: IDIQ_BASE,
  campaign: "get_started_primary",
  source: "disputeiq",
});

const steps = [
  {
    n: "01",
    k: "Report intake",
    t: "Get your real 3-bureau report",
    d: "Continue with IdentityIQ to pull a live Experian, Equifax, and TransUnion file. This is the report DisputeIQ will analyze.",
    bullets: [
      "Live tri-merge report",
      "All three bureaus",
      "Refresh on demand",
      "Delivered to you, not to us",
    ],
    cta: { label: "Continue with IdentityIQ →", href: idiqLink, external: true },
    meta: `${IDIQ.productName} · the supported provider for DisputeIQ`,
  },
  {
    n: "02",
    k: "Return to DisputeIQ",
    t: "Come back to disputeiq.org",
    d: "Once you have your report in hand, come back here and open your DisputeIQ command center. Your workspace is ready the moment you sign in.",
    bullets: [
      "No manual matching",
      "Your workspace is ready",
      "Sign in or create an account",
      "Private by design",
    ],
    cta: { label: "Open the portal →", href: "/sign-up", external: false },
    meta: "Sign in / create your DisputeIQ account",
  },
  {
    n: "03",
    k: "Upload & analyze",
    t: "Upload your report and begin",
    d: "Upload the tri-merge PDF to DisputeIQ. Cross-bureau analysis runs in minutes, surfacing actionable findings ranked by severity with drafted next-best actions.",
    bullets: [
      "Cross-bureau diff engine",
      "Severity-ranked findings",
      "AI next-best action",
      "Draft disputes from facts",
    ],
    cta: { label: "Upload your report →", href: `${URLS.app}/dashboard/reports`, external: true },
    meta: "Lands directly in the tri-merge action center",
  },
];

export default function GetStartedPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[520px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Start your file · A Screwed Up Credit company
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-[68px]">
            Three steps.
            <br />
            <span className="italic">One command center.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            Every DisputeIQ workflow begins with a real 3-bureau report. Start with our
            supported provider IdentityIQ, return to DisputeIQ, and turn the file into action.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-20">
          <ol className="space-y-6">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className={`group relative overflow-hidden rounded-[24px] border p-10 transition lg:p-12 ${
                  i === 0
                    ? "border-transparent bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] text-white shadow-[0_40px_120px_-32px_rgba(79,70,229,0.5)]"
                    : "border-border bg-surface text-fg shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)] hover:border-indigo-500/40"
                }`}
              >
                {i === 0 && (
                  <>
                    <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
                  </>
                )}
                <div className="relative grid gap-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                  <div className="flex items-baseline gap-4 lg:flex-col lg:items-start">
                    <span
                      className={`font-serif text-[64px] italic leading-none lg:text-[96px] ${
                        i === 0 ? "text-white/90" : "text-indigo-600/80"
                      }`}
                    >
                      {s.n}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                        i === 0 ? "text-indigo-200" : "text-fg-subtle"
                      }`}
                    >
                      {s.k}
                    </span>
                  </div>
                  <div>
                    <h2
                      className={`font-serif text-[28px] leading-tight tracking-tight sm:text-[34px] ${
                        i === 0 ? "text-white" : "text-fg"
                      }`}
                    >
                      {s.t}
                    </h2>
                    <p
                      className={`mt-4 max-w-2xl text-[15px] leading-relaxed ${
                        i === 0 ? "text-white/70" : "text-fg-muted"
                      }`}
                    >
                      {s.d}
                    </p>
                    <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                      {s.bullets.map((b) => (
                        <li
                          key={b}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.12em] ${
                            i === 0
                              ? "border border-white/10 bg-white/[0.05] text-white/80"
                              : "border border-border bg-surface-muted text-fg-muted"
                          }`}
                        >
                          <span
                            className={`h-1 w-1 rounded-full ${
                              i === 0 ? "bg-emerald-400" : "bg-emerald-600"
                            }`}
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p
                      className={`mt-6 text-[11px] uppercase tracking-[0.18em] ${
                        i === 0 ? "text-white/40" : "text-fg-subtle"
                      }`}
                    >
                      {s.meta}
                    </p>
                  </div>
                  <div className="lg:min-w-[200px]">
                    {s.cta.external ? (
                      <a
                        href={s.cta.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] transition ${
                          i === 0
                            ? "bg-white text-fg shadow-[0_18px_60px_-16px_rgba(255,255,255,0.55)] hover:scale-[1.015]"
                            : "border border-fg bg-fg text-canvas hover:bg-fg/90"
                        }`}
                      >
                        {s.cta.label}
                      </a>
                    ) : (
                      <Link
                        href={s.cta.href}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fg bg-fg px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-canvas transition hover:bg-fg/90"
                      >
                        {s.cta.label}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ / compliance clarification */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-28">
          <div className="rounded-[24px] border border-border bg-surface-muted p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
              Good to know
            </p>
            <h3 className="mt-4 font-serif text-[26px] leading-tight text-fg">
              A few things before you start.
            </h3>
            <ul className="mt-7 grid gap-5 text-[14px] leading-relaxed text-fg-muted sm:grid-cols-2">
              <li>
                <p className="font-semibold text-fg">Why IdentityIQ?</p>
                <p className="mt-1 text-fg-muted">
                  IdentityIQ is the supported report provider for DisputeIQ. It delivers the
                  3-bureau file DisputeIQ uses for analysis — reliable imports, accurate
                  dispute workflow.
                </p>
              </li>
              <li>
                <p className="font-semibold text-fg">Your file, your file.</p>
                <p className="mt-1 text-fg-muted">
                  You can dispute inaccuracies yourself, for free, directly with the bureaus.
                  DisputeIQ is a workflow and software tool — we help you organize and act accurately.
                </p>
              </li>
              <li>
                <p className="font-semibold text-fg">No guaranteed outcomes.</p>
                <p className="mt-1 text-fg-muted">
                  We do not guarantee removals or score changes. Nobody legitimate can. DisputeIQ
                  optimizes for accuracy and documentation, not promises.
                </p>
              </li>
              <li>
                <p className="font-semibold text-fg">You confirm every step.</p>
                <p className="mt-1 text-fg-muted">
                  Nothing leaves the platform without your explicit confirmation. No auto-dispatch,
                  no hidden actions, no silent fees.
                </p>
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/trust-center"
                className="inline-flex items-center gap-2 rounded-xl border border-fg bg-fg px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-canvas transition hover:bg-fg/90"
              >
                Read the trust center →
              </Link>
              <Link
                href="/disclosures"
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-fg transition hover:border-fg"
              >
                Full disclosures
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
