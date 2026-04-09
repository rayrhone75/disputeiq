import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_BASE_URL ?? "https://disputeiq.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
