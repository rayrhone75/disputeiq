/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // The lawyer pipeline reads its system prompts from .txt files via `fs`
  // at runtime (lib/credit-import/lawyer-pipeline.ts). Next can't trace a
  // computed `process.cwd()` path automatically, so without this include
  // the files are absent from the deployed lambda and analysis silently
  // breaks. Explicitly bundle the prompts into the routes that use them.
  outputFileTracingIncludes: {
    "/api/reports/analyze": ["./lib/credit-import/prompts/**"],
    "/api/reports/analyze-stream": ["./lib/credit-import/prompts/**"],
  },
};
export default nextConfig;
