import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allSlugs, getTopic } from "@/lib/seo/content";
import { SeoArticle } from "@/components/marketing/SeoArticle";

export function generateStaticParams() {
  return allSlugs().map((topic) => ({ topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) return { title: "Not found" };
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    keywords: t.keywords,
    alternates: { canonical: `/learn/${t.slug}` },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      type: "article",
      url: `/learn/${t.slug}`,
    },
    twitter: { card: "summary_large_image", title: t.metaTitle, description: t.metaDescription },
  };
}

export default async function LearnTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) return notFound();
  return <SeoArticle topic={t} breadcrumbBase={{ href: "/learn", label: "Learn" }} />;
}
