import type { MetadataRoute } from "next";
import { SEO_TOPICS } from "@/lib/seo/content";

const STATIC = ["", "/how-it-works", "/pricing", "/get-started", "/trust-center", "/learn", "/guides", "/how-to"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_BASE_URL ?? "https://disputeiq.com";
  const now = new Date();
  const staticEntries = STATIC.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const seoEntries = SEO_TOPICS.flatMap((t) =>
    ["learn", "guides", "how-to"].map((prefix) => ({
      url: `${base}/${prefix}/${t.slug}`,
      lastModified: new Date(t.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  );
  return [...staticEntries, ...seoEntries];
}
