// Single processing entry point for credit reports.
//
// Every upload entry point (upload-any, paste, legacy upload,
// extension/import/myscoreiq) calls this one function. It owns the
// "bytes/text → normalized MyScoreIQ-shape JSON" pipeline so we never
// drift between routes. Downstream `runJsonPipeline` consumes the
// output and handles Convex persistence + dispute candidates.
//
// Stages, in order:
//   1. Extract: PDF → Mistral OCR + cleanup, HTML → MFSN/generic
//      parser, text/json → passthrough.
//   2. Paralegal: Mistral chat extracts VH-shape JSON.
//   3. Regex overrides: replace AI inquiries/collections with regex
//      results when the source text has unambiguous table data.
//   4. Adapter: VH-shape → MyScoreIQParsedJson the IdentityIQ adapter
//      expects.

import {
  cleanOcrMarkdown,
  extractPdfWithMistralOcr,
  MistralOcrError,
} from "./mistral-ocr";
import { aiParalegalExtract, ParalegalExtractionError } from "./ai-paralegal";
import { extractHtml } from "./extract-html";
import { applyRegexOverrides } from "./regex-overrides";
import { vhParalegalToMyScoreIQ } from "./vh-to-myscoreiq";
import type { MyScoreIQParseResult } from "./myscoreiq-text";

export type ProcessInput =
  | { format: "pdf"; bytes: Buffer; filename: string }
  | { format: "html"; bytes: Buffer }
  | { format: "text"; text: string }
  | { format: "json"; text: string };

export type ProcessLogger = {
  logStage: (event: string, data?: Record<string, unknown>) => void;
};

export type ProcessOutcome = {
  result: MyScoreIQParseResult;
  extractedText: string;
  source: "pdf" | "html-mfsn" | "html-generic" | "text" | "json";
};

export { MistralOcrError, ParalegalExtractionError };

export async function processCreditReport(
  input: ProcessInput,
  logger: ProcessLogger,
): Promise<ProcessOutcome> {
  let extracted: string;
  let source: ProcessOutcome["source"];

  switch (input.format) {
    case "pdf": {
      const ocr = await extractPdfWithMistralOcr(input.bytes, input.filename);
      extracted = cleanOcrMarkdown(ocr.markdown);
      source = "pdf";
      logger.logStage("ocr_extracted", {
        rawLength: ocr.markdown.length,
        cleanedLength: extracted.length,
        pages: ocr.pageCount,
      });
      break;
    }
    case "html": {
      const html = input.bytes.toString("utf8");
      const ex = extractHtml(html);
      extracted = ex.markdown;
      source = ex.source === "mfsn" ? "html-mfsn" : "html-generic";
      logger.logStage("html_extracted", {
        length: extracted.length,
        htmlSource: ex.source,
      });
      break;
    }
    case "text":
      extracted = input.text;
      source = "text";
      logger.logStage("text_received", { length: extracted.length });
      break;
    case "json":
      extracted = input.text;
      source = "json";
      logger.logStage("json_received", { length: extracted.length });
      break;
  }

  const parsed = await aiParalegalExtract(extracted);
  logger.logStage("paralegal_extracted", {
    accounts: parsed.accounts?.length ?? 0,
    collections: parsed.collections?.length ?? 0,
    inquiries: parsed.inquiries?.length ?? 0,
    publicRecords: parsed.public_records?.length ?? 0,
  });

  applyRegexOverrides(parsed, extracted);
  logger.logStage("regex_overrides_applied", {
    inquiries: parsed.inquiries?.length ?? 0,
    collections: parsed.collections?.length ?? 0,
  });

  const result = vhParalegalToMyScoreIQ(parsed);
  logger.logStage("adapter_done", {
    confidence: result.confidence,
    counts: result.counts,
    reasonCodes: result.reasonCodes,
  });

  return { result, extractedText: extracted, source };
}
