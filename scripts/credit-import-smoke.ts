// CLI smoke test for the credit-import pipeline.
//
// Usage:
//   tsx scripts/credit-import-smoke.ts
//   tsx scripts/credit-import-smoke.ts path/to/report.json
//
// Runs the adapter + dispute engine against a JSON file (defaults to the
// bundled fixture) and prints a concise summary. Does not touch the DB.

import fs from "node:fs";
import path from "node:path";
import { identityIqAdapter } from "../lib/credit-import/providers/identityiq";
import { runDisputeEngine } from "../lib/credit-import/dispute-engine";
import { NormalizedReportZ } from "../lib/credit-import/schemas";

const file =
  process.argv[2] ??
  path.resolve(__dirname, "../lib/credit-import/fixtures/identityiq-sample.json");

const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const normalized = identityIqAdapter.normalize(raw);
const validation = NormalizedReportZ.safeParse(normalized);
const candidates = runDisputeEngine(normalized);

console.log("=== Credit-import smoke test ===");
console.log("File:", file);
console.log("Provider:", normalized.provider);
console.log("Bureaus detected:", normalized.bureausDetected.join(", ") || "(none)");
console.log("Tradelines:", normalized.tradelines.length);
console.log("Inquiries:", normalized.inquiries.length);
console.log("Collections:", normalized.collections.length);
console.log("Public records:", normalized.publicRecords.length);
console.log("Scores:", normalized.scores.length);
console.log("Warnings:", normalized.validationWarnings.join(", ") || "(none)");
console.log("Zod validation:", validation.success ? "OK" : `FAIL — ${JSON.stringify(validation.error.format())}`);
console.log("Dispute candidates:", candidates.length);
for (const c of candidates) {
  console.log(`  [${c.severity}] ${c.bureau} ${c.reason} — ${c.summary}`);
}
