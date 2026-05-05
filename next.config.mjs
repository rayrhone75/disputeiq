/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // pdf-parse pulls in pdfjs-dist, which breaks when Next.js bundles it
  // into the serverless function (dynamic worker resolution + a
  // module-level test-fixture read in pdf-parse@1.1.x). Externalizing
  // it makes Vercel install it node_modules-side so `require("pdf-parse")`
  // hits the real package at runtime. Without this, parseReportPdf()
  // silently returns empty text and every PDF upload from MyScoreIQ
  // falls through to "We couldn't read tradelines from this file."
  serverExternalPackages: ["pdf-parse"],
};
export default nextConfig;
