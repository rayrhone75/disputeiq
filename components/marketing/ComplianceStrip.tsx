const pillars = [
  {
    title: "DIY credit dispute software",
    body: "You direct every action. DisputeIQ prepares packets, sends them on your written authorization, and tracks the response — you remain in control.",
  },
  {
    title: "Not a credit repair agency",
    body: "DisputeIQ is not a credit repair organization, law firm, or credit bureau. We do not negotiate with creditors or furnishers on your behalf.",
  },
  {
    title: "No guaranteed outcomes",
    body: "Results depend on the accuracy of your reports and the response of each bureau or furnisher. Anyone promising a specific score lift is not telling you the truth.",
  },
];

export function ComplianceStrip() {
  return (
    <section className="relative border-t border-[#e8e4d8] bg-[#f2efe5]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8a8472]">
            Compliance at a glance
          </p>
          <p className="hidden text-[11px] text-[#6b6556] sm:block">
            FCRA 15 U.S.C. §1681 · CFPB-informed · Per-tenant isolated data
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="relative rounded-2xl border border-[#e0dccf] bg-white/80 p-6"
            >
              <span className="absolute right-5 top-5 h-1.5 w-1.5 rounded-full bg-indigo-500/70" />
              <h3 className="font-serif text-[17px] leading-tight tracking-tight text-[#0a0f1c]">
                {p.title}
              </h3>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#4a4638]">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-[#6b6556]">
          You have the right to dispute inaccuracies yourself, for free, directly with the credit
          bureaus. DisputeIQ is a tool that helps you exercise that right with more structure,
          better documentation, and a clearer audit trail.
        </p>
      </div>
    </section>
  );
}
