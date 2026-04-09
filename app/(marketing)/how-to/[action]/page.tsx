import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allSlugs, getTopic } from "@/lib/seo/content";
import { SeoArticle } from "@/components/marketing/SeoArticle";

export function generateStaticParams() {
  return allSlugs().map((action) => ({ action }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ action: string }>;
}): Promise<Metadata> {
  const { action } = await params;
  const t = getTopic(action);
  if (!t) return { title: "Not found" };
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/how-to/${t.slug}` },
    openGraph: { title: t.metaTitle, description: t.metaDescription, type: "article" },
  };
}

export default async function HowToActionPage({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const { action } = await params;
  const t = getTopic(action);
  if (!t) return notFound();
  return <SeoArticle topic={t} breadcrumbBase={{ href: "/how-to", label: "How-to" }} />;
}
