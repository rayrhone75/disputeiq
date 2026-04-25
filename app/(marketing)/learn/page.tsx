import Link from "next/link";
import type { Metadata } from "next";
import { SEO_TOPICS } from "@/lib/seo/content";

export const metadata: Metadata = {
  title: "Learn — Credit Repair Guides | DisputeIQ",
  description:
    "In-depth, FCRA-grounded guides on disputing credit reports, removing collections, charge-offs, late payments, and more.",
};

export default function LearnIndex() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Learn</h1>
      <p className="mt-3 text-lg text-fg/70">
        Real, FCRA-grounded guides written by people who actually do this work. No fluff, no scams.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SEO_TOPICS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/learn/${t.slug}`}
              className="block rounded-2xl border border-border bg-surface p-6 transition hover:border-indigo-400 hover:shadow-lg"
            >
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="mt-2 text-sm text-fg/70">{t.metaDescription}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-indigo-600">
                Read guide →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
