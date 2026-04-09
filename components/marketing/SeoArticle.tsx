import Link from "next/link";
import type { SeoTopic } from "@/lib/seo/content";
import { LeadCaptureForm } from "@/components/marketing/LeadCaptureForm";

export function SeoArticle({
  topic,
  breadcrumbBase,
}: {
  topic: SeoTopic;
  breadcrumbBase: { href: string; label: string };
}) {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: topic.title,
    description: topic.metaDescription,
    datePublished: topic.updatedAt,
    dateModified: topic.updatedAt,
    author: { "@type": "Organization", name: topic.authorName },
    publisher: { "@type": "Organization", name: "DisputeIQ" },
    keywords: topic.keywords.join(", "),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: topic.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: breadcrumbBase.label, item: breadcrumbBase.href },
      {
        "@type": "ListItem",
        position: 3,
        name: topic.title,
        item: `${breadcrumbBase.href}/${topic.slug}`,
      },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="mb-6 text-xs text-[#0a0f1c]/60">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={breadcrumbBase.href} className="hover:underline">
          {breadcrumbBase.label}
        </Link>{" "}
        / <span>{topic.title}</span>
      </nav>

      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{topic.title}</h1>
      <p className="mt-4 text-lg text-[#0a0f1c]/70">{topic.hero}</p>
      <p className="mt-2 text-xs text-[#0a0f1c]/40">
        Updated {topic.updatedAt} · {topic.authorName}
      </p>

      <div className="my-10 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-6">
        <h2 className="text-base font-semibold text-indigo-900">{topic.cta.headline}</h2>
        <p className="mt-1 text-sm text-indigo-900/80">{topic.cta.body}</p>
        <Link
          href={topic.cta.href}
          className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {topic.cta.label} →
        </Link>
      </div>

      <div className="prose prose-neutral mt-12 max-w-none">
        {topic.sections.map((s) => (
          <section key={s.heading} className="mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">{s.heading}</h2>
            {s.body.split("\n\n").map((p, i) => (
              <p key={i} className="mt-4 leading-relaxed text-[#0a0f1c]/85">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <section className="mt-16 border-t border-[#0a0f1c]/10 pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 space-y-6">
          {topic.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-semibold">{f.q}</h3>
              <p className="mt-2 text-[#0a0f1c]/80">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-[#0a0f1c]/10 bg-white p-8">
        <h2 className="text-xl font-semibold">Get a free credit analysis preview</h2>
        <p className="mt-1 text-sm text-[#0a0f1c]/70">
          Drop your email and we'll send you the next steps for your situation. No spam, ever.
        </p>
        <div className="mt-5">
          <LeadCaptureForm source={`seo:${topic.slug}`} topic={topic.slug} />
        </div>
      </section>
    </article>
  );
}
