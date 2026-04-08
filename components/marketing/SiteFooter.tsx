import Link from "next/link";

const cols = [
  {
    t: "Product",
    l: [
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
      ["Contact", "mailto:support@disputeiq.org"],
    ] as const,
  },
  {
    t: "Legal",
    l: [
      ["Privacy", "/trust-center"],
      ["Terms", "/trust-center"],
      ["Compliance", "/trust-center"],
    ] as const,
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-[#e8e4d8] bg-[#f2efe5]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-[0_10px_28px_-8px_rgba(79,70,229,0.5)]">
                <div className="absolute inset-[2px] rounded-[7px] bg-[#0a0f1c]" />
                <div className="absolute inset-0 flex items-center justify-center font-serif text-[15px] italic text-white">
                  D
                </div>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-serif text-[17px] font-semibold tracking-tight text-[#0a0f1c]">
                  DisputeIQ
                </span>
                <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#6b6556]">
                  Audit-grade credit operations
                </span>
              </div>
            </Link>
            <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-[#4a4638]">
              The executive workspace for reviewing credit reports, preparing dispute documents,
              and tracking certified mailings — with audit-grade trust built into every step.
            </p>
            <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-[#8a8472]">
              Made in the United States · Audit-grade by design
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.t}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a8472]">
                  {c.t}
                </p>
                <ul className="mt-5 space-y-3 text-[13px] text-[#4a4638]">
                  {c.l.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith("mailto") ? (
                        <a href={href} className="transition hover:text-[#0a0f1c]">
                          {label}
                        </a>
                      ) : (
                        <Link href={href} className="transition hover:text-[#0a0f1c]">
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

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#e0dccf] pt-8 text-[11px] text-[#6b6556] sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DisputeIQ — disputeiq.org</p>
          <p className="max-w-xl text-[10px] leading-relaxed">
            You may dispute inaccuracies yourself, for free, directly with the bureaus. DisputeIQ is
            a software and workflow tool. We do not guarantee removals or score changes.
          </p>
        </div>
      </div>
    </footer>
  );
}
