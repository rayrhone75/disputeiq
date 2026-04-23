import Link from "next/link";

export type RailTile = {
  label: string;
  value: number;
  hint: string;
  tone: "emerald" | "indigo" | "amber" | "rose";
  href: string;
  icon: "check" | "list" | "clock" | "flag";
};

const toneRing: Record<RailTile["tone"], string> = {
  emerald: "from-emerald-500/20 to-emerald-500/5 ring-emerald-200",
  indigo: "from-indigo-500/20 to-indigo-500/5 ring-indigo-200",
  amber: "from-amber-500/20 to-amber-500/5 ring-amber-200",
  rose: "from-rose-500/20 to-rose-500/5 ring-rose-200",
};

const toneText: Record<RailTile["tone"], string> = {
  emerald: "text-emerald-700",
  indigo: "text-indigo-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
};

function Glyph({ icon }: { icon: RailTile["icon"] }) {
  const common = "h-4 w-4";
  if (icon === "check") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (icon === "list") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    );
  }
  if (icon === "clock") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}

export function ExecutiveRail({ tiles }: { tiles: readonly RailTile[] }) {
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${toneRing[c.tone]} p-6 ring-1 transition hover:-translate-y-0.5 hover:shadow-lg`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${toneText[c.tone]}`}>
              {c.label}
            </p>
            <span className={toneText[c.tone]}>
              <Glyph icon={c.icon} />
            </span>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink-900">{c.value}</p>
          <p className="mt-1 text-xs text-ink-600">{c.hint}</p>
          <span className="absolute right-4 bottom-4 text-xs text-ink-400 opacity-0 transition group-hover:opacity-100">
            →
          </span>
        </Link>
      ))}
    </section>
  );
}
