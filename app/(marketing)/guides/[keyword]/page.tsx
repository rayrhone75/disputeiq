import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allSlugs, getTopic } from "@/lib/seo/content";
import { SeoArticle } from "@/components/marketing/SeoArticle";

export function generateStaticParams() {
  return allSlugs().map((keyword) => ({ keyword }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ keyword: string }>;
}): Promise<Metadata> {
  const { keyword } = await params;
  const t = getTopic(keyword);
  if (!t) return { title: "Not found" };
  return {
    title: `${t.metaTitle} | DisputeIQ Guide`,
    description: t.metaDescription,
    keywords: t.keywords,
    alternates: { canonical: `/guides/${t.slug}` },
    openGraph: { title: t.metaTitle, description: t.metaDescription, type: "article" },
  };
}

export default async function GuideKeywordPage({
  params,
}: {
  params: Promise<{ keyword: string }>;
}) {
  const { keyword } = await params;
  const t = getTopic(keyword);
  if (!t) return notFound();
  return <SeoArticle topic={t} breadcrumbBase={{ href: "/guides", label: "Guides" }} />;
}
