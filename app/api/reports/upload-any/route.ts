import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { storage } from "@/lib/storage";
import {
  parseReportPdf,
  parseReportText,
  type ParseResult,
} from "@/lib/report-parser";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import { parseMyScoreIQText } from "@/lib/credit-import/myscoreiq-text";

// One endpoint to rule them all. Customers upload a credit report from
// MyScoreIQ in any of four shapes:
//
//   - JSON (the report's "view=json" tab, saved with Ctrl+S)   → full
//     automated parse via the credit-import runner. Real dispute
//     candidates land in seconds.
//   - PDF  ("Download this report" / "Print → Save as PDF")    → text
//     extraction, then a search for an embedded MyScoreIQ JSON blob
//     (some PDF builds inline the raw payload). If found, full parse.
//     Otherwise heuristic text parse + legacy creditReports row so the
//     file is in the system and support can review.
//   - HTML ("Save Page As → Webpage, complete")                → strip
//     tags, then identical PDF/text-fallback handling.
//   - TXT  (paste-as-text export)                              → same.
//
// The contract intentionally mirrors `/api/reports/paste` so the client
// component can dispatch to one endpoint and use one response shape.
//
// Why a separate route from /api/reports/upload (PDF-only, legacy):
// the legacy route writes to creditReports and never touches the new
// import pipeline. The dashboard's results page reads creditImports
// only — so PDFs needed to flow through createImport/captureRaw to be
// visible. Combining them under one route also means we can grow the
// MIME list (e.g. .csv) without forking the client again.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// PDF text extraction + Convex round-trips can comfortably exceed
// Vercel's 10s default on real-world MyScoreIQ exports.
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

type DetectedFormat = "json" | "pdf" | "html" | "txt" | "unknown";

type ParserPath =
  | "json"
  | "embedded-json"
  | "pdf-heuristic"
  | "html-heuristic"
  | "txt-heuristic"
  | "rejected";

// Context carried through every helper so the import-health log can
// attribute each event back to its user + file. Built once at the top
// of POST after auth + file extraction.
type UploadCtx = {
  clerkUserId: string | null;
  fileName: string | null;
  fileSize: number | null;
  format: DetectedFormat;
};

// Fire-and-forget logger. Never throws — a Convex blip must not block
// the actual upload response. Telemetry being best-effort matters more
// than catching every event.
function recordEvent(
  ctx: UploadCtx,
  outcome: {
    parserPath: ParserPath;
    ok: boolean;
    parseStatus?: string;
    tradelineCount?: number;
    candidateCount?: number;
    errorMessage?: string;
  },
): void {
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) return;
  void fetchMutation(api.importHealth.record, {
    secret,
    clerkUserId: ctx.clerkUserId ?? undefined,
    format: ctx.format,
    parserPath: outcome.parserPath,
    ok: outcome.ok,
    parseStatus: outcome.parseStatus,
    tradelineCount: outcome.tradelineCount ?? 0,
    candidateCount: outcome.candidateCount,
    fileSize: ctx.fileSize ?? undefined,
    fileName: ctx.fileName ?? undefined,
    errorMessage: outcome.errorMessage,
  }).catch(() => null);
}

// Customer-facing response contract. The client (`ManualUploadCard`)
// branches on `outcome` and renders one of three states:
//   - "imported"     → success card with counts + "View dispute
//                      opportunities" CTA + auto-redirect.
//   - "needs_review" → polite "support is reviewing" message; no
//                      retry, no error styling.
//   - "failed"       → retry-friendly error (the upload didn't go
//                      through; the user can try again).
//
// `parseStatus` and the legacy fields (reportId, parsedCount, …) stay
// for backward compatibility with any other callers / tests.
type Outcome = "imported" | "needs_review" | "failed";

type SuccessShape = {
  outcome: Outcome;
  confidence: "high" | "medium" | "low";
  tradelineCount: number;
  /** collections + publicRecords for the success path; 0 elsewhere. */
  negativeCount?: number;
  candidateCount: number | null;
  importId: string | null;
  // Legacy mirrors of the above for any older callers that still read them:
  reportId: string | null;
  parsedCount: number;
  parseStatus: "parsed" | "needs_manual_review";
  reviewFlags: string[];
  bureauGuess: string | null;
  redirectTo?: string;
  message?: string;
  detectedFormat: DetectedFormat;
};

export async function POST(req: NextRequest) {
  // Hard rule: this endpoint must never return 5xx. Acceptance
  // criterion #5 ("failed parse never breaks customer experience") is
  // load-bearing — any unexpected throw becomes a 200 with the same
  // friendly "we received your report" message, plus an
  // importHealthEvents row so an admin can investigate.
  const ctx: UploadCtx = {
    clerkUserId: null,
    fileName: null,
    fileSize: null,
    format: "unknown",
  };
  try {
    return await runUploadAny(req, ctx);
  } catch (err) {
    recordEvent(ctx, {
      parserPath: ctx.format === "unknown" ? "rejected" : "rejected",
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `UNHANDLED: ${(err as Error).message.slice(0, 400)}`,
    });
    // eslint-disable-next-line no-console
    console.error("[upload-any] unhandled error", err);
    return jsonResponse({
      outcome: "needs_review",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["UNHANDLED_ERROR"],
      bureauGuess: null,
      detectedFormat: ctx.format,
      message: "We received your report. Our support team is reviewing it.",
    });
  }
}

async function runUploadAny(
  req: NextRequest,
  ctx: UploadCtx,
): Promise<NextResponse> {
  const { userId, getToken } = await auth();
  ctx.clerkUserId = userId ?? null;

  if (!userId) {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: "UNAUTHENTICATED",
    });
    return NextResponse.json(
      { error: "UNAUTHENTICATED", outcome: "failed" as Outcome },
      { status: 401 },
    );
  }
  const token = (await getToken({ template: "convex" })) ?? null;

  // CRITICAL: ensure the customer's Convex `users` row exists before
  // any pipeline mutation runs. Convex `createImport` (and every other
  // user-scoped function) calls `requireUser(ctx)`, which throws
  // `USER_NOT_MIRRORED` for any Clerk identity that hasn't been
  // upserted yet. The dashboard pages don't auto-mirror, so a
  // brand-new customer's first action is often this upload — which
  // would silently fail and leave them with an empty results screen.
  // The mutation is idempotent (no-op when nothing has changed), so
  // calling it on every upload is cheap and safe.
  if (token) {
    try {
      const u = await currentUser();
      const email =
        u?.primaryEmailAddress?.emailAddress ??
        u?.emailAddresses?.[0]?.emailAddress ??
        "";
      if (email) {
        await fetchMutation(
          api.users.upsertFromClerk,
          { email },
          { token },
        );
      }
    } catch {
      // Don't block the upload on a mirror miss — the safety-net
      // catch below will turn any subsequent throw into a clean
      // `needs_review` for the customer plus a logged event for
      // admin triage. Most causes (transient Convex blip) won't
      // affect the next request.
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: `BAD_FORM: ${(err as Error).message.slice(0, 200)}`,
    });
    return NextResponse.json(
      {
        error: "BAD_FORM",
        outcome: "failed" as Outcome,
        message: (err as Error).message,
      },
      { status: 400 },
    );
  }

  const file = form.get("file") as File | null;
  if (!file) {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: "BAD_REQUEST: missing file field",
    });
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        outcome: "failed" as Outcome,
        message: "Attach a file as `file`.",
      },
      { status: 400 },
    );
  }
  ctx.fileName = file.name || null;
  ctx.fileSize = file.size;

  if (file.size > MAX_BYTES) {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: `FILE_TOO_LARGE: ${file.size} bytes`,
    });
    return NextResponse.json(
      {
        error: "FILE_TOO_LARGE",
        outcome: "failed" as Outcome,
        message: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max 25 MB.`,
      },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const lowerName = (file.name || "").toLowerCase();
  const detected = detectFormat(buf, lowerName, file.type);
  ctx.format = detected;

  if (detected === "unknown") {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: `UNSUPPORTED_FORMAT: name=${lowerName} mime=${file.type}`,
    });
    return NextResponse.json(
      {
        error: "UNSUPPORTED_FORMAT",
        outcome: "failed" as Outcome,
        message:
          "Unsupported file. Upload a PDF, HTML, TXT, or JSON copy of your MyScoreIQ report.",
      },
      { status: 415 },
    );
  }

  // ── JSON (or text that happens to start with `{`) ────────────────────
  if (detected === "json") {
    const text = buf.toString("utf8");
    return await runJsonPipeline(token, text, "json", ctx, "json");
  }

  // ── TXT ──────────────────────────────────────────────────────────────
  if (detected === "txt") {
    const text = buf.toString("utf8");
    return await runTextOrEmbeddedJson(token, text, "txt", ctx, "txt-heuristic");
  }

  // ── HTML ─────────────────────────────────────────────────────────────
  if (detected === "html") {
    const html = buf.toString("utf8");
    const text = stripHtml(html);
    return await runTextOrEmbeddedJson(
      token,
      text,
      "html",
      ctx,
      "html-heuristic",
    );
  }

  // ── PDF ──────────────────────────────────────────────────────────────
  // Persist the original bytes so admins can re-parse if our heuristics
  // miss something. Best-effort — storage.put backed by S3 may not be
  // configured in dev; failures here shouldn't block the import.
  let pdfRef: string | undefined;
  try {
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    pdfRef = await storage.put(
      `reports/${userId}/${hash}.pdf`,
      buf,
      "application/pdf",
    );
  } catch {
    pdfRef = undefined;
  }

  const parsedPdf = await parseReportPdf(buf);
  // First try to find an embedded JSON blob (rare but possible).
  if (parsedPdf.text) {
    const embedded = sniffEmbeddedJson(parsedPdf.text);
    if (embedded) {
      return await runJsonPipeline(
        token,
        embedded,
        "pdf",
        ctx,
        "embedded-json",
      );
    }
  }

  // Run the dedicated MyScoreIQ text parser on the extracted PDF text.
  // When it lands ≥ medium confidence we feed its JSON output through
  // the same pipeline as a real JSON upload — the customer sees real
  // tradelines and dispute candidates from the PDF without any new
  // persistence code.
  if (parsedPdf.text) {
    const myscore = parseMyScoreIQText(parsedPdf.text);
    if (myscore.confidence !== "low" && myscore.counts.tradelines > 0) {
      return await runJsonPipeline(
        token,
        JSON.stringify(myscore.json),
        "pdf",
        ctx,
        "pdf-heuristic",
        myscore.confidence,
      );
    }
  }

  // Low-confidence PDF — capture for admin review, write any tradelines
  // the legacy heuristic could find to creditReports for /dashboard/
  // reports visibility.
  const legacyId = await writeLegacyText(token, parsedPdf, pdfRef);
  await captureForReview(token, parsedPdf.text || "", "MYSCOREIQ_PDF_LOW_CONFIDENCE", ctx);

  // Empty extraction (image-based PDF, encrypted PDF, pdf-parse failed
  // to load on Vercel) → outcome:"failed" so the customer sees a
  // retry message pointing them at the JSON download. Otherwise the
  // page would silently land on StepResults with all zeros.
  if (parsedPdf.tradelines.length === 0) {
    const isEmptyText = !parsedPdf.text || !parsedPdf.text.trim();
    recordEvent(ctx, {
      parserPath: "pdf-heuristic",
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: isEmptyText
        ? "PDF_EMPTY_TEXT_EXTRACTION"
        : `PDF_NO_TRADELINES: ${parsedPdf.reviewFlags.join(",")}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: legacyId,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: parsedPdf.reviewFlags,
      bureauGuess: null,
      detectedFormat: "pdf",
      message: isEmptyText
        ? "We couldn't read any text from this PDF — it may be image-based or encrypted. The most reliable option is to download the JSON version from MyScoreIQ. If you only have a PDF, try opening it and re-saving via Print → Save as PDF."
        : "We couldn't find tradelines in this PDF. The best option is to download the JSON version from MyScoreIQ — that always works.",
    });
  }

  recordEvent(ctx, {
    parserPath: "pdf-heuristic",
    ok: true,
    parseStatus: "needs_manual_review",
    tradelineCount: parsedPdf.tradelines.length,
  });
  return jsonResponse({
    outcome: "needs_review",
    confidence: "low",
    tradelineCount: parsedPdf.tradelines.length,
    candidateCount: null,
    importId: null,
    reportId: legacyId,
    parsedCount: parsedPdf.tradelines.length,
    parseStatus: "needs_manual_review",
    reviewFlags: parsedPdf.reviewFlags,
    bureauGuess: parsedPdf.bureauGuess ?? null,
    detectedFormat: "pdf",
    message: "We received your report. Our support team is reviewing it.",
  });
}

// ── Format detection ────────────────────────────────────────────────────
function detectFormat(
  buf: Buffer,
  lowerName: string,
  mime: string,
): DetectedFormat {
  // Magic bytes win — file extensions and MIME types lie.
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "pdf";
  }

  // Trim leading whitespace to peek at first non-space char.
  let i = 0;
  while (i < buf.length && i < 4096) {
    const c = buf[i];
    if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0xfe && c !== 0xff && c !== 0xef && c !== 0xbb && c !== 0xbf) {
      break;
    }
    i++;
  }
  const first = buf[i] ?? 0;

  if (first === 0x7b /* { */ || first === 0x5b /* [ */) return "json";

  // HTML sniff: common openings.
  if (
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    mime === "text/html" ||
    looksLikeHtml(buf, i)
  ) {
    return "html";
  }

  if (
    lowerName.endsWith(".json") ||
    mime === "application/json"
  ) {
    return "json";
  }

  if (
    lowerName.endsWith(".txt") ||
    mime === "text/plain" ||
    mime === "" ||
    mime === "application/octet-stream"
  ) {
    return "txt";
  }

  return "unknown";
}

function looksLikeHtml(buf: Buffer, start: number): boolean {
  const head = buf.subarray(start, Math.min(start + 1024, buf.length)).toString("utf8").toLowerCase();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.includes("<head") ||
    head.includes("<body")
  );
}

function stripHtml(html: string): string {
  // Cheap-and-cheerful tag stripper. We don't need a DOM — MyScoreIQ's
  // saved HTML is a flat report, and embedded scripts/styles are
  // skipped before tag removal so they don't leak into the text.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sniffEmbeddedJson(text: string): string | null {
  // MyScoreIQ "Print" / Webpage-Complete saves sometimes include the
  // raw report JSON inline. Heuristic: find the first "{" that opens a
  // braces-balanced block containing one of the known top-level keys.
  const KNOWN_KEYS = [
    '"creditReport"',
    '"CreditReportType"',
    '"Bureau"',
    '"tradelines"',
  ];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          if (KNOWN_KEYS.some((k) => candidate.includes(k))) {
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              // bad JSON; keep scanning
            }
          }
          break;
        }
      }
    }
  }
  return null;
}

// ── JSON pipeline (mirrors /api/reports/paste) ───────────────────────────
async function runJsonPipeline(
  token: string | null,
  text: string,
  detectedFormat: DetectedFormat,
  ctx: UploadCtx,
  parserPath: ParserPath,
  sourceConfidence?: "high" | "medium",
): Promise<NextResponse> {
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
  } catch (err) {
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `JSON_INVALID: ${(err as Error).message.slice(0, 200)}`,
    });
    return jsonResponse({
      // Genuine retry path — the file the user uploaded wasn't valid
      // JSON, so a re-upload of a correct file fixes it. "failed" is
      // the right outcome, not "needs_review".
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["JSON_INVALID"],
      bureauGuess: null,
      detectedFormat,
      message: `That file isn't valid JSON. Try downloading the report again — it may have saved partially.`,
    });
  }

  let importId: Id<"creditReportImports"> | null = null;
  try {
    const created = await createImport(
      { token },
      { provider: "MYSCOREIQ", sourceUrl: undefined },
    );
    importId =
      (created as { _id: Id<"creditReportImports"> } | null)?._id ?? null;
    if (!importId) {
      recordEvent(ctx, {
        parserPath,
        ok: false,
        parseStatus: "needs_manual_review",
        errorMessage: "CREATE_RETURNED_NULL",
      });
      return jsonResponse({
        outcome: "needs_review",
        confidence: "low",
        tradelineCount: 0,
        candidateCount: null,
        importId: null,
        reportId: null,
        parsedCount: 0,
        parseStatus: "needs_manual_review",
        reviewFlags: ["CREATE_RETURNED_NULL"],
        bureauGuess: null,
        detectedFormat,
        message: "We received your report. Our support team is reviewing it.",
      });
    }
    await captureRaw(
      { token },
      { importId, bodyText: trimmed, onlyIfOwnedByMe: true },
    );
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      recordEvent(ctx, {
        parserPath,
        ok: false,
        parseStatus: "needs_manual_review",
        errorMessage: `JSON_${err.code}: ${err.message.slice(0, 200)}`,
      });
      return jsonResponse({
        outcome: "needs_review",
        confidence: "low",
        tradelineCount: 0,
        candidateCount: null,
        importId: null,
        reportId: null,
        parsedCount: 0,
        parseStatus: "needs_manual_review",
        reviewFlags: [`JSON_${err.code}`],
        bureauGuess: null,
        detectedFormat,
        message: "We received your report. Our support team is reviewing it.",
      });
    }
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `JSON_CAPTURE_ERROR: ${(err as Error).message.slice(0, 200)}`,
    });
    return jsonResponse({
      outcome: "needs_review",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["JSON_CAPTURE_ERROR"],
      bureauGuess: null,
      detectedFormat,
      message: "We received your report. Our support team is reviewing it.",
    });
  }

  try {
    const result = await runNormalization({ token }, { importId });
    const tradelineCount = result.report.tradelines.length;
    const candidateCount = result.candidatesCreated;
    const negativeCount =
      result.report.collections.length + result.report.publicRecords.length;
    const imported = tradelineCount > 0;
    const parseStatus = imported ? "parsed" : "needs_manual_review";
    // For sources where the caller already knows the parse confidence
    // (e.g. PDF/HTML/TXT going through the MyScoreIQ text parser),
    // honor that. Otherwise infer from the tradeline count: any
    // tradelines at all is "high" for a JSON upload that already
    // matched the adapter's schema.
    const confidence = imported
      ? sourceConfidence ?? "high"
      : "low";
    recordEvent(ctx, {
      parserPath,
      ok: true,
      parseStatus,
      tradelineCount,
      candidateCount,
    });
    return jsonResponse({
      outcome: imported ? "imported" : "needs_review",
      confidence,
      tradelineCount,
      negativeCount,
      candidateCount,
      importId: importId as unknown as string,
      reportId: importId as unknown as string,
      parsedCount: tradelineCount,
      parseStatus,
      reviewFlags: result.report.validationWarnings,
      bureauGuess: result.report.bureausDetected[0] ?? null,
      detectedFormat,
      message: imported
        ? "Your report was imported successfully."
        : "We received your report. Our support team is reviewing it.",
    });
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "JSON_NORMALIZE_ERROR";
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `${code}: ${(err as Error).message.slice(0, 200)}`,
    });
    return jsonResponse({
      // File made it into the new pipeline (creditReportImports row
      // exists), but normalization couldn't run. Admin can re-run; the
      // customer doesn't need to do anything. → needs_review, not failed.
      outcome: "needs_review",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: importId as unknown as string,
      reportId: importId as unknown as string,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: [code],
      bureauGuess: null,
      detectedFormat,
      message: "We received your report. Our support team is reviewing it.",
    });
  }
}

// ── Text path ────────────────────────────────────────────────────────────
//
// Three-step ladder, applied in order:
//   1. If the text contains an embedded MyScoreIQ JSON blob (rare —
//      some Print views inline it), pull it out and run the full JSON
//      pipeline. Cleanest possible outcome.
//   2. Otherwise run the dedicated MyScoreIQ text parser
//      (lib/credit-import/myscoreiq-text.ts). When it returns
//      confidence ≥ "medium", build a JSON payload in the adapter's
//      shape and feed it through the SAME JSON pipeline — the
//      customer sees real tradelines and dispute candidates without
//      any new persistence code on our side.
//   3. Confidence "low" means the parser couldn't find a tri-merge
//      structure. Capture the raw text into the new pipeline so
//      admins can review, write a legacy creditReports row for any
//      tradelines the heuristic found, and return the friendly
//      "We received your report. Our support team is reviewing it."
//      message — never an error.
async function runTextOrEmbeddedJson(
  token: string | null,
  text: string,
  detectedFormat: DetectedFormat,
  ctx: UploadCtx,
  fallbackParserPath: ParserPath,
): Promise<NextResponse> {
  const embedded = sniffEmbeddedJson(text);
  if (embedded) {
    return await runJsonPipeline(
      token,
      embedded,
      detectedFormat,
      ctx,
      "embedded-json",
    );
  }

  // Dedicated MyScoreIQ text parser.
  const myscore = parseMyScoreIQText(text);
  if (myscore.confidence !== "low" && myscore.counts.tradelines > 0) {
    return await runJsonPipeline(
      token,
      JSON.stringify(myscore.json),
      detectedFormat,
      ctx,
      fallbackParserPath,
      myscore.confidence,
    );
  }

  // Low-confidence fallback. Capture the raw text into the new
  // pipeline so admins can review, and run the legacy heuristic so
  // anything we can extract still lands in /dashboard/reports.
  const result = parseReportText(text);
  const legacyId = await writeLegacyText(
    token,
    {
      tradelines: result.tradelines,
      reviewFlags: result.reviewFlags,
      bureauGuess: result.bureauGuess,
    },
    undefined,
  );
  await captureForReview(token, text, "MYSCOREIQ_TEXT_LOW_CONFIDENCE", ctx);

  // If the legacy heuristic ALSO produced zero tradelines, the file
  // was effectively unreadable (whitespace-only after stripHtml, a
  // SPA save with no rendered content, a binary mis-detected as text,
  // etc.) — return outcome:"failed" so the customer sees an
  // actionable retry message that points them at the JSON download
  // (the canonical best path) instead of being silently funneled to
  // a results page with zero numbers. If we DID extract some
  // tradelines from the heuristic, fall through to needs_review so
  // support can verify what we got.
  const allZeros = result.tradelines.length === 0;
  if (allZeros) {
    recordEvent(ctx, {
      parserPath: fallbackParserPath,
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: `EMPTY_EXTRACTION ${detectedFormat.toUpperCase()}: ${myscore.reasonCodes.concat(result.reviewFlags).join(",")}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: legacyId,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: result.reviewFlags.concat(myscore.reasonCodes),
      bureauGuess: null,
      detectedFormat,
      message:
        detectedFormat === "html"
          ? "We couldn't read tradelines from this saved web page. MyScoreIQ renders the report with JavaScript, so the saved HTML is empty. Please download the JSON version from MyScoreIQ instead — it's the most reliable option."
          : "We couldn't read tradelines from this file. The best option is to download the JSON version from MyScoreIQ — that always works. As a backup, save the page as PDF (Print → Save as PDF) and try uploading that.",
    });
  }

  recordEvent(ctx, {
    parserPath: fallbackParserPath,
    ok: true,
    parseStatus: "needs_manual_review",
    tradelineCount: result.tradelines.length,
    errorMessage:
      myscore.reasonCodes.length > 0
        ? `LOW_CONFIDENCE: ${myscore.reasonCodes.join(",")}`
        : undefined,
  });
  return jsonResponse({
    outcome: "needs_review",
    confidence: "low",
    tradelineCount: result.tradelines.length,
    candidateCount: null,
    importId: null,
    reportId: legacyId,
    parsedCount: result.tradelines.length,
    parseStatus: "needs_manual_review",
    reviewFlags: result.reviewFlags.concat(myscore.reasonCodes),
    bureauGuess: result.bureauGuess ?? null,
    detectedFormat,
    message: "We received your report. Our support team is reviewing it.",
  });
}

// ── Legacy creditReports writer ─────────────────────────────────────────
async function writeLegacyText(
  token: string | null,
  parsed: Pick<ParseResult, "tradelines" | "reviewFlags" | "bureauGuess">,
  rawSecureRef: string | undefined,
): Promise<string | null> {
  // Returns null on any failure — legacy creditReports may reject the
  // call (USER_NOT_MIRRORED for very-new accounts, schema drift, token
  // expiry, transient blip). The new pipeline's captureRaw stub still
  // gives admins a copy to review, so we never want this to throw all
  // the way out and turn into a 500 for the customer.
  try {
    const created = await fetchMutation(
      api.creditReports.createReport,
      {
      source: "MANUAL_UPLOAD",
      snapshotHash: crypto.randomBytes(16).toString("hex"),
      rawSecureRef,
      tradelines: parsed.tradelines.map((t) => ({
        bureau: t.bureau,
        creditorName: t.creditorName,
        accountRefMasked: t.accountRefMasked,
        balanceCents: t.balanceCents,
        pastDueCents: t.pastDueCents,
        statusLabel: t.statusLabel,
        openedAtMs:
          t.openedAt instanceof Date ? t.openedAt.getTime() : undefined,
        lastReportedAtMs:
          t.lastReportedAt instanceof Date
            ? t.lastReportedAt.getTime()
            : undefined,
        lastActivityAtMs:
          t.lastActivityAt instanceof Date
            ? t.lastActivityAt.getTime()
            : undefined,
        isCollection: t.isCollection ?? false,
        isMedical: t.isMedical ?? false,
      })),
      auditAction: "REPORT_UPLOADED",
      auditMetadataJson: {
        parsedCount: parsed.tradelines.length,
        reviewFlags: parsed.reviewFlags,
        bureauGuess: parsed.bureauGuess,
      },
    },
    { token: token ?? undefined },
  );
    return (created?.id as string) ?? null;
  } catch {
    return null;
  }
}

// Best-effort capture into the new pipeline so admins can see the file
// even when normalization can't run. Failures here are non-fatal for
// the customer (they still see the friendly message), but they are
// fatal for our admin visibility — so we explicitly log to console and
// to importHealth instead of silently swallowing the error. The most
// common silent-failure cause we hit was a missing ENCRYPTION_KEY in
// Vercel prod which makes captureRaw throw before persisting anything.
async function captureForReview(
  token: string | null,
  bodyText: string,
  reasonTag: string,
  ctx?: UploadCtx,
): Promise<void> {
  if (!bodyText) return;
  try {
    const created = await createImport(
      { token },
      { provider: "MYSCOREIQ", importMethod: reasonTag },
    );
    const importId =
      (created as { _id: Id<"creditReportImports"> } | null)?._id ?? null;
    if (!importId) return;
    await captureRaw(
      { token },
      { importId, bodyText, onlyIfOwnedByMe: true },
    );
    // Don't run normalization — text isn't JSON, it would just FAIL the
    // import and pollute the snapshot. Leaving it in CAPTURED state is
    // the right signal for a human to look at.
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    // eslint-disable-next-line no-console
    console.error("[upload-any] captureForReview failed", {
      reasonTag,
      message: msg,
    });
    if (ctx) {
      recordEvent(ctx, {
        parserPath: "rejected",
        ok: false,
        parseStatus: "needs_manual_review",
        errorMessage: `CAPTURE_FOR_REVIEW_FAILED(${reasonTag}): ${msg.slice(0, 300)}`,
      });
    }
  }
}

function jsonResponse(body: SuccessShape, status = 200): NextResponse {
  return NextResponse.json(
    {
      ...body,
      negativeCount: body.negativeCount ?? 0,
      redirectTo: body.redirectTo ?? "/dashboard/get-report?imported=1",
    },
    { status },
  );
}
