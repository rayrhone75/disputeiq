import Link from "next/link";

const cols = [
  {
    t: "Product",
    l: [
      ["Get started", "/get-started"],
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Trust center", "/trust-center"],
    ] as const,
  },
  {
    t: "Company",
    l: [
      ["Method", "/how-it-works"],
      ["Trust & security", "/trust-center"],
      ["Disclosures", "/disclosures"],
      ["Contact", "mailto:support@disputeiq.org"],
    ] as const,
  },
  {
    t: "Legal",
    l: [
      ["Terms of Service", "/terms"],
      ["Privacy Policy", "/privacy"],
      ["Refund Policy", "/refund-policy"],
      ["Disclosures", "/disclosures"],
    ] as const,
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-canvas">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-[0_10px_28px_-8px_rgba(79,70,229,0.5)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-surface-strong" />
                <div className="absolute inset-0 flex items-center justify-center font-serif text-[15px] italic text-white">
                  D
                </div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-serif text-[17px] font-semibold tracking-tight text-fg">
                  DisputeIQ
                </span>
                <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-fg-subtle">
                  Audit-grade credit operations
                </span>
              </div>
            </Link>
            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-fg-muted">
              The executive workspace for reviewing credit reports, preparing dispute documents,
              and tracking certified mailings — with audit-grade trust built into every step.
            </p>
            <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
              A Screwed Up Credit company · Made in the USA
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.t}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
                  {c.t}
                </p>
                <ul className="mt-5 space-y-3 text-[13px] text-fg-muted">
                  {c.l.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith("mailto") ? (
                        <a href={href} className="transition hover:text-fg">
                          {label}
                        </a>
                      ) : (
                        <Link href={href} className="transition hover:text-fg">
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

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border-strong pt-8 text-[11px] text-fg-subtle sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DisputeIQ — disputeiq.org</p>
          <p className="max-w-2xl text-[10px] leading-relaxed">
            DisputeIQ is a self-directed software platform that helps you analyze credit report
            data, prepare dispute packets, and track mailing and response activity. DisputeIQ is{" "}
            <strong>not a credit repair agency, law firm, or credit bureau</strong>, and does not
            guarantee deletions, score increases, or specific outcomes. You may dispute
            inaccuracies yourself, for free, directly with the bureaus.
          </p>
        </div>
      </div>
    </footer>
  );
}
