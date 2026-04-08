import Link from "next/link";
import { URLS } from "@/lib/urls";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e8e4d8] bg-[#f7f5ee]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-[0_8px_24px_-8px_rgba(79,70,229,0.45)]">
            <div className="absolute inset-[2px] rounded-[7px] bg-[#0a0f1c]" />
            <div className="absolute inset-0 flex items-center justify-center font-serif text-[15px] italic text-white">
              D
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-[16px] font-semibold tracking-tight text-[#0a0f1c]">
              DisputeIQ
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#6b6556]">
              Audit-grade credit operations
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-9 text-[13px] text-[#4a4638] md:flex">
          <Link href="/how-it-works" className="transition hover:text-[#0a0f1c]">Method</Link>
          <Link href="/pricing" className="transition hover:text-[#0a0f1c]">Pricing</Link>
          <Link href="/trust-center" className="transition hover:text-[#0a0f1c]">Trust center</Link>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={`${URLS.app}/sign-in`}
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-[#4a4638] transition hover:text-[#0a0f1c] sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href={`${URLS.app}/sign-up`}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-[#0a0f1c] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(10,15,28,0.6)] transition hover:bg-[#111827]"
          >
            Open the portal
            <span className="transition group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
