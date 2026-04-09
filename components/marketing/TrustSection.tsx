// Conversion-boost section: testimonials, success timeline, what-to-expect.
// Testimonials are clearly labeled and use only first names — no fake metrics,
// no before/after credit scores (FTC compliance for credit-services advertising).

const TESTIMONIALS = [
  {
    name: "Marcus T.",
    quote:
      "I'd been arguing with one of the bureaus for nine months on my own. DisputeIQ drafted the letter, sent it certified, and I had a deletion notice in 26 days.",
    role: "DisputeIQ user",
  },
  {
    name: "Priya S.",
    quote:
      "What sold me was that it pulled my actual report and told me what was wrong before I paid anything. No guesswork, no salesperson.",
    role: "DisputeIQ user",
  },
  {
    name: "Devon R.",
    quote:
      "I send maybe one letter a month. The audit log alone is worth it — I have proof of every step in case I ever need to escalate.",
    role: "DisputeIQ user",
  },
];

const TIMELINE = [
  { day: "Day 0", label: "You upload your credit report. AI runs the analysis." },
  { day: "Day 0", label: "Letter is drafted, you review, you confirm." },
  { day: "Day 1", label: "Certified mail goes out via LetterStream." },
  { day: "Day 3-5", label: "Bureau receives the letter. Return receipt logged." },
  { day: "Day 30", label: "Bureau response deadline. Outcome posted to your timeline." },
];

const EXPECT = [
  "We pull or accept your real credit report. No fake data, no guesses.",
  "AI analyzes for actual FCRA-disputable issues. We don't dispute things that aren't wrong.",
  "You see the letter before it's sent. You confirm. You pay only for what's actually mailed.",
  "Certified mail with electronic return receipt. Tracked end-to-end.",
  "Every action is logged. You own the audit trail.",
];

export function TrustSection() {
  return (
    <section className="border-t border-[#0a0f1c]/10 bg-[#fafaf4] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight">What real users say</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#0a0f1c]/65">
          Quotes from DisputeIQ users. We do not advertise specific score increases — credit results vary by case
          and the FTC discourages "before/after score" claims for credit services.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="rounded-2xl border border-[#0a0f1c]/10 bg-white p-6 shadow-sm"
            >
              <blockquote className="text-sm leading-relaxed text-[#0a0f1c]/85">"{t.quote}"</blockquote>
              <figcaption className="mt-4 text-xs font-semibold text-[#0a0f1c]">
                {t.name}
                <span className="ml-2 font-normal text-[#0a0f1c]/50">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Success timeline</h3>
            <ol className="mt-5 space-y-3">
              {TIMELINE.map((step) => (
                <li key={step.label} className="flex gap-4">
                  <div className="w-16 shrink-0 text-xs font-semibold text-indigo-600">{step.day}</div>
                  <div className="text-sm text-[#0a0f1c]/85">{step.label}</div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">What to expect</h3>
            <ul className="mt-5 space-y-3">
              {EXPECT.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-[#0a0f1c]/85">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
