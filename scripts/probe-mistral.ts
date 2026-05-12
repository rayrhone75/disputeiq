// Local smoke test for the Mistral OCR + paralegal pipeline.
// Usage:  npx tsx scripts/probe-mistral.ts <path-to-pdf>
// Requires MISTRAL_API_KEY in environment (loads .env.local if present).
//
// Exit codes:
//   0 — full pipeline ran, paralegal returned ≥1 account
//   1 — any stage failed

import fs from "node:fs";
import path from "node:path";

// Load .env.local so the script picks up local secrets without a shell
// export. tsx's default behavior doesn't auto-load envs.
function loadLocalEnv() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadLocalEnv();

import {
  extractPdfWithMistralOcr,
  cleanOcrMarkdown,
} from "../lib/credit-import/mistral-ocr";
import { aiParalegalExtract } from "../lib/credit-import/ai-paralegal";
import { applyRegexOverrides } from "../lib/credit-import/regex-overrides";
import { vhParalegalToMyScoreIQ } from "../lib/credit-import/vh-to-myscoreiq";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("usage: tsx scripts/probe-mistral.ts <path-to-pdf>");
    process.exit(2);
  }
  if (!process.env.MISTRAL_API_KEY) {
    console.error("MISTRAL_API_KEY not set (looked at .env.local and process.env)");
    process.exit(2);
  }
  const abs = path.resolve(pdfPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(2);
  }

  const buf = fs.readFileSync(abs);
  const filename = path.basename(abs);
  console.log(`[probe] PDF: ${abs} (${buf.length} bytes)`);

  // 1. OCR
  const t1 = Date.now();
  const ocr = await extractPdfWithMistralOcr(buf, filename);
  const ocrMs = Date.now() - t1;
  console.log(
    `[probe] OCR ok: ${ocr.pageCount} page(s), ${ocr.markdown.length} chars raw, ${ocrMs} ms`,
  );

  // 2. Cleanup
  const cleaned = cleanOcrMarkdown(ocr.markdown);
  const ratio = ocr.markdown.length
    ? Math.round((cleaned.length / ocr.markdown.length) * 100)
    : 0;
  console.log(`[probe] cleaned to ${cleaned.length} chars (${ratio}% of raw)`);

  // 3. Paralegal
  const t2 = Date.now();
  const parsed = await aiParalegalExtract(cleaned);
  const paralegalMs = Date.now() - t2;
  console.log(
    `[probe] paralegal ok in ${paralegalMs} ms: accounts=${parsed.accounts?.length ?? 0} collections=${parsed.collections?.length ?? 0} inquiries=${parsed.inquiries?.length ?? 0}`,
  );

  // 4. Regex overrides
  applyRegexOverrides(parsed, cleaned);
  console.log(
    `[probe] regex overlay: collections=${parsed.collections?.length ?? 0} inquiries=${parsed.inquiries?.length ?? 0}`,
  );

  // 5. Adapter
  const out = vhParalegalToMyScoreIQ(parsed);
  console.log(`[probe] adapter: confidence=${out.confidence}`);
  console.log(`[probe] counts:`, out.counts);
  console.log(`[probe] reasonCodes:`, out.reasonCodes);
  console.log(`[probe] borrower:`, out.json.borrower);
  console.log(`[probe] first tradeline:`, out.json.tradelines?.[0]);

  if (out.counts.tradelines === 0) {
    console.error("[probe] FAIL: zero tradelines extracted");
    process.exit(1);
  }
  console.log("[probe] OK");
}

main().catch((err) => {
  console.error("[probe] error:", err);
  process.exit(1);
});
