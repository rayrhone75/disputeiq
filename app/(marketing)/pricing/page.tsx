import Link from "next/link";
import { getLetterPricing } from "@/lib/pricing";
import { URLS } from "@/lib/urls";

export const metadata = {
  title: "Pricing — DisputeIQ",
  description: "Honest, action-based pricing. Pay only when you take action. No subscriptions.",
};

export default function PricingPage() {
  const standard = getLetterPricing({ isGraceUser: false });
  const sw = (standard.softwareFee / 100).toFixed(2);
  const mail = (standard.mailingFee / 100).toFixed(2);
  const total = (standard.total / 100).toFixed(2);

  const tiers = [
    {
      name: "Starter",
      tag: "For first-time users",
      price: "Free",
      cadence: "to start",
      desc: "Open a workspace, upload a report, and review what you find. Pay only when you act.",
      features: [
        "1 workspace",
        "Cross-bureau analyzer",
        "Document vault (1 GB)",
        "Action pricing per letter",
        "Email support",
      ],
      cta: "Open the portal",
      highlight: false,
    },
    {
      name: "Professional",
      tag: "Most chosen",
      price: "$29",
      cadence: "/month",
      desc: "For active credit work and certified dispatch with priority handling.",
      features: [
        "Unlimited workspaces",
        "USPS certified mail tracking",
        "AI assistant in-app",
        "Document vault (25 GB)",
        "Audit log export",
        "Priority support",
      ],
      cta: "Start Professional",
      highlight: true,
    },
    {
      name: "Private Office",
      tag: "Families & advisors",
      price: "$199",
      cadence: "/month",
      desc: "For families, fiduciaries, and high-volume credit operations.",
      features: [
        "Multi-profile support",
        "Dedicated success manager",
        "API access",
        "White-glove onboarding",
        "Quarterly strategy review",
        "Priority dispatch queue",
      ],
      cta: "Request invitation",
      highlight: false,
    },
  ];

  const faqs = [
    {
      q: "Do I have to pay a subscription?",
      a: "No. Starter is free to open. You only pay when you actually dispatch a letter — software fee plus certified mailing. Professional and Private Office add monthly tooling on top.",
    },
    {
      q: "What does the action fee cover?",
      a: `The $${sw} software fee covers document preparation, review packaging, and audit logging. The $${mail} mailing fee covers USPS certified mail with electronic return receipt and delivery tracking.`,
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Cancel from your portal at any time. You keep access through the end of the billing period and can export your full history.",
    },
    {
      q: "Do you guarantee removals or score changes?",
      a: "No. Nobody legitimate can. DisputeIQ is a workflow and software tool — we help you organize, prepare, and track your own actions accurately.",
    },
  ];

  return (
    <>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[520px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
            Investment
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-[#0a0f1c] sm:text-[68px]">
            Premium tools.
            <br />
            <span className="italic">Honest pricing.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-[#4a4638]">
            No long-term contracts. No hidden fees. Pay for action — not for promises.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col overflow-hidden rounded-[24px] border p-8 transition ${
                  t.highlight
                    ? "border-transparent bg-gradient-to-br from-[#0c1222] via-[#0a0f1c] to-[#080d18] text-white shadow-[0_40px_120px_-32px_rgba(79,70,229,0.55)]"
                    : "border-[#e8e4d8] bg-white text-[#0a0f1c] shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)] hover:border-indigo-500/50"
                }`}
              >
                {t.highlight && (
                  <>
                    <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/35 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-violet-500/25 blur-3xl" />
                  </>
                )}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <p
                      className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                        t.highlight ? "text-indigo-200" : "text-indigo-600"
                      }`}
                    >
                      {t.name}
                    </p>
                    {t.highlight && (
                      <span className="rounded-full border border-indigo-300/30 bg-indigo-400/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
                        {t.tag}
                      </span>
                    )}
                    {!t.highlight && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#8a8472]">
                        {t.tag}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span
                      className={`font-serif text-[56px] leading-none ${
                        t.highlight ? "text-white" : "text-[#0a0f1c]"
                      }`}
                    >
                      {t.price}
                    </span>
                    <span
                      className={`text-[13px] ${t.highlight ? "text-white/55" : "text-[#8a8472]"}`}
                    >
                      {t.cadence}
                    </span>
                  </div>
                  <p
                    className={`mt-4 text-[13px] leading-relaxed ${
                      t.highlight ? "text-white/70" : "text-[#4a4638]"
                    }`}
                  >
                    {t.desc}
                  </p>

                  <ul
                    className={`mt-7 space-y-3.5 border-t pt-6 text-[13px] ${
                      t.highlight
                        ? "border-white/10 text-white/85"
                        : "border-[#e8e4d8] text-[#3d3a2e]"
                    }`}
                  >
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                            t.highlight
                              ? "border border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                              : "border border-indigo-500/30 bg-indigo-50 text-indigo-700"
                          }`}
                        >
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
                        ? "bg-white text-[#0a0f1c] shadow-[0_14px_44px_-12px_rgba(255,255,255,0.55)] hover:scale-[1.015]"
                        : "border border-[#0a0f1c] bg-[#0a0f1c] text-white hover:bg-[#111827]"
                    }`}
                  >
                    {t.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Action pricing */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-[24px] border border-[#e8e4d8] bg-white p-10 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_24px_48px_-24px_rgba(10,15,28,0.16)] lg:p-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
                  Per-letter action pricing
                </p>
                <h2 className="mt-5 font-serif text-[34px] leading-[1.1] tracking-tight text-[#0a0f1c] sm:text-[42px]">
                  You only pay when you{" "}
                  <span className="italic">actually act.</span>
                </h2>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#4a4638]">
                  Every dispatched letter has a transparent two-line cost. Nothing is sent without
                  your explicit confirmation, and the breakdown is shown before you confirm.
                </p>
              </div>
              <div className="rounded-2xl border border-[#e8e4d8] bg-[#faf9f4] p-7">
                <div className="flex items-center justify-between border-b border-[#e8e4d8] pb-4">
                  <p className="text-[13px] text-[#4a4638]">Software fee</p>
                  <p className="font-serif text-[20px] text-[#0a0f1c]">${sw}</p>
                </div>
                <div className="flex items-center justify-between border-b border-[#e8e4d8] py-4">
                  <p className="text-[13px] text-[#4a4638]">Certified mailing</p>
                  <p className="font-serif text-[20px] text-[#0a0f1c]">${mail}</p>
                </div>
                <div className="flex items-center justify-between pt-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a8472]">Total per letter</p>
                  <p className="font-serif text-[36px] text-[#0a0f1c]">${total}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative">
        <div className="mx-auto max-w-5xl px-6 pb-28">
          <div className="mb-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-600">
              Frequently asked
            </p>
            <h2 className="mt-5 font-serif text-[36px] leading-[1.1] tracking-tight text-[#0a0f1c] sm:text-[44px]">
              Pricing, plainly.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-[#e8e4d8] bg-white p-7 shadow-[0_1px_0_0_rgba(10,15,28,0.03),0_18px_36px_-24px_rgba(10,15,28,0.12)]"
              >
                <p className="font-serif text-[18px] text-[#0a0f1c]">{f.q}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#4a4638]">{f.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/trust-center"
              className="inline-flex items-center gap-2 rounded-xl border border-[#0a0f1c] bg-[#0a0f1c] px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#111827]"
            >
              Read the trust center →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
