import Link from "next/link";
import type { Metadata } from "next";
import { SEO_TOPICS } from "@/lib/seo/content";

export const metadata: Metadata = {
  title: "Credit Repair Guides | DisputeIQ",
  description: "Step-by-step credit dispute guides, written for consumers, grounded in the FCRA.",
};

export default function GuidesIndex() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Guides</h1>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SEO_TOPICS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/guides/${t.slug}`}
              className="block rounded-2xl border border-border bg-surface p-6 hover:border-indigo-400"
            >
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="mt-2 text-sm text-fg/70">{t.hero}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
