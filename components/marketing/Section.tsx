import type { ReactNode } from "react";

export function Section({
  eyebrow,
  title,
  subtitle,
  children,
  tone = "light",
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const isDark = tone === "dark";
  return (
    <section
      className={
        isDark
          ? "relative overflow-hidden bg-[#0a0f1c] text-white"
          : "relative bg-transparent text-[#0a0f1c]"
      }
    >
      {isDark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-20%] h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)] blur-3xl" />
          <div className="absolute right-[-10%] top-[60%] h-[420px] w-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.14),transparent)] blur-3xl" />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div className={`mb-14 max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
          {eyebrow && (
            <p
              className={`font-mono text-[10px] uppercase tracking-[0.28em] ${
                isDark ? "text-indigo-300/90" : "text-indigo-600"
              }`}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className={`mt-5 font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[48px] ${
              isDark ? "text-white" : "text-[#0a0f1c]"
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`mt-5 max-w-2xl text-[16px] leading-relaxed ${
                align === "center" ? "mx-auto" : ""
              } ${isDark ? "text-white/65" : "text-[#4a4638]"}`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
