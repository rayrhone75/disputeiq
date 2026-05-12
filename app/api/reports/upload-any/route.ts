import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { storage } from "@/lib/storage";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import {
  processCreditReport,
  MistralOcrError,
  ParalegalExtractionError,
  type ProcessInput,
} from "@/lib/credit-import/process-report";

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
  | "json-paralegal"
  | "text-paralegal"
  | "html-paralegal"
  | "pdf-mistral-paralegal"
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

// Stage-by-stage logging. Every upload writes one structured log line
// per stage (auth → mirror → form-parse → format-detect → parse →
// capture → normalize). Vercel logs become a deterministic trace, so
// when a customer says "upload failed" we can grep their requestId and
// see exactly which stage threw. Cheap and load-bearing for
// debuggability — DO NOT remove without putting an alternative in place.
function logStage(
  requestId: string,
  stage: string,
  data: Record<string, unknown> = {},
): void {
  // eslint-disable-next-line no-console
  console.log(`[upload-any] ${stage}`, { requestId, ...data });
}

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
  const requestId = crypto.randomUUID();
  logStage(requestId, "request:received");
  try {
    return await runUploadAny(req, ctx, requestId);
  } catch (err) {
    recordEvent(ctx, {
      parserPath: ctx.format === "unknown" ? "rejected" : "rejected",
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `UNHANDLED: ${(err as Error).message.slice(0, 400)}`,
    });
    // eslint-disable-next-line no-console
    console.error("[upload-any] unhandled error", {
      requestId,
      message: (err as Error).message,
      stack: (err as Error).stack?.slice(0, 1500),
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
      reviewFlags: [`UNHANDLED_ERROR: ${(err as Error).message.slice(0, 200)}`],
      bureauGuess: null,
      detectedFormat: ctx.format,
      message: "We received your report. Our support team is reviewing it.",
    });
  }
}

async function runUploadAny(
  req: NextRequest,
  ctx: UploadCtx,
  requestId: string,
): Promise<NextResponse> {
  const { userId, getToken } = await auth();
  ctx.clerkUserId = userId ?? null;
  logStage(requestId, "auth:resolved", { userId: userId ?? null });

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
  logStage(requestId, "auth:token", { hasToken: !!token });

  // Pre-flight: the captureRaw step encrypts the body via lib/encryption.ts
  // which throws if ENCRYPTION_KEY is missing/short. If we don't catch
  // that here, every JSON path silently lands in `needs_review` limbo.
  // Detect early and surface a clear server-config error to the user
  // (they can't fix it, but support sees the actual failure mode in
  // the response, not a "support is reviewing" wallpaper).
  const encKey = process.env.ENCRYPTION_KEY ?? "";
  if (encKey.length < 32) {
    logStage(requestId, "preflight:encryption_key_missing");
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: "MISSING_ENCRYPTION_KEY",
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["MISSING_ENCRYPTION_KEY"],
      bureauGuess: null,
      detectedFormat: "unknown",
      message:
        "Server configuration error (ENCRYPTION_KEY missing). Please contact support — this isn't your file's fault.",
    });
  }

  // The Mistral key powers OCR (PDF text extraction) and the paralegal
  // LLM that emits the normalized JSON. Without it the entire processing
  // pipeline fails, so surface the misconfiguration as a clear server
  // error rather than letting Mistral 401s bubble out as a generic
  // "needs_review."
  const mistralKey = process.env.MISTRAL_API_KEY ?? "";
  if (!mistralKey) {
    logStage(requestId, "preflight:mistral_key_missing");
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: "MISSING_MISTRAL_API_KEY",
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["MISSING_MISTRAL_API_KEY"],
      bureauGuess: null,
      detectedFormat: "unknown",
      message:
        "Server configuration error (MISTRAL_API_KEY missing). Please contact support — this isn't your file's fault.",
    });
  }

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
  logStage(requestId, "format:detected", {
    detected,
    name: lowerName,
    mime: file.type,
    size: file.size,
  });

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

  // PDF storage: best-effort persist the original bytes so admins can
  // re-process or audit later. Storage layer may not be configured in
  // dev; failures here shouldn't block the import. Done before
  // processing so even a fully-failed run still has the source file.
  if (detected === "pdf") {
    try {
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      await storage.put(`reports/${userId}/${hash}.pdf`, buf, "application/pdf");
    } catch {
      // Non-fatal — original bytes archival only.
    }
  }

  // Build the processing input. Every format converges on a single
  // pipeline (Mistral OCR / HTML extract → AI paralegal → regex
  // overrides → adapter) so we never drift between routes.
  const processInput: ProcessInput =
    detected === "pdf"
      ? { format: "pdf", bytes: buf, filename: file.name || "report.pdf" }
      : detected === "html"
      ? { format: "html", bytes: buf }
      : detected === "json"
      ? { format: "json", text: buf.toString("utf8") }
      : { format: "text", text: buf.toString("utf8") };

  const parserPath: ParserPath =
    detected === "pdf"
      ? "pdf-mistral-paralegal"
      : detected === "html"
      ? "html-paralegal"
      : detected === "json"
      ? "json-paralegal"
      : "text-paralegal";

  let outcome:
    | { kind: "ok"; result: Awaited<ReturnType<typeof processCreditReport>>["result"]; extractedText: string }
    | { kind: "ocr_failed"; err: MistralOcrError }
    | { kind: "paralegal_failed"; err: ParalegalExtractionError }
    | { kind: "process_failed"; err: Error };
  try {
    const processed = await processCreditReport(processInput, {
      logStage: (e, d) => logStage(requestId, `process:${e}`, d),
    });
    outcome = {
      kind: "ok",
      result: processed.result,
      extractedText: processed.extractedText,
    };
  } catch (err) {
    if (err instanceof MistralOcrError) {
      outcome = { kind: "ocr_failed", err };
    } else if (err instanceof ParalegalExtractionError) {
      outcome = { kind: "paralegal_failed", err };
    } else {
      outcome = { kind: "process_failed", err: err as Error };
    }
  }

  if (outcome.kind === "ocr_failed") {
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: `MISTRAL_OCR_FAILED:${outcome.err.stage}:${outcome.err.status}: ${outcome.err.body.slice(0, 200)}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: [`MISTRAL_OCR_${outcome.err.stage.toUpperCase()}_FAILED`],
      bureauGuess: null,
      detectedFormat: detected,
      message:
        "We couldn't extract text from this PDF. Mistral OCR didn't accept it — please try uploading the JSON version of your report instead, or re-save the PDF using Print → Save as PDF.",
    });
  }

  if (outcome.kind === "paralegal_failed") {
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: `PARALEGAL_FAILED:${outcome.err.status}: ${outcome.err.body.slice(0, 200)}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: [`PARALEGAL_EXTRACTION_FAILED`],
      bureauGuess: null,
      detectedFormat: detected,
      message:
        "We extracted text from your report but couldn't structure the data. This usually means the report format is unfamiliar — please try the JSON version, or contact support.",
    });
  }

  if (outcome.kind === "process_failed") {
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: `PROCESS_FAILED: ${outcome.err.message.slice(0, 200)}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: [`PROCESS_FAILED: ${outcome.err.message.slice(0, 200)}`],
      bureauGuess: null,
      detectedFormat: detected,
      message: "Something went wrong processing your report. Please try again or contact support.",
    });
  }

  const { result, extractedText } = outcome;

  // Paralegal returned no tradelines — file processed cleanly but
  // doesn't look like a credit report (or is a layout we don't yet
  // understand). Capture for admin review so we can debug; surface
  // a clear "we didn't find a credit report" message instead of a
  // silent zeros screen.
  if (result.counts.tradelines === 0) {
    await captureForReview(
      token,
      extractedText,
      `PARALEGAL_EMPTY_RESULT:${detected}`,
      ctx,
    );
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "failed",
      tradelineCount: 0,
      errorMessage: `PARALEGAL_EMPTY_RESULT: ${result.reasonCodes.join(",")}`,
    });
    return jsonResponse({
      outcome: "failed",
      confidence: "low",
      tradelineCount: 0,
      candidateCount: null,
      importId: null,
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: result.reasonCodes,
      bureauGuess: null,
      detectedFormat: detected,
      message:
        detected === "html"
          ? "We extracted text from this saved web page but couldn't find a credit report in it. MyScoreIQ renders the report with JavaScript, so the saved HTML is often empty. Please download the JSON or PDF version instead."
          : "We couldn't find a credit report in this file. Try uploading the JSON version from MyScoreIQ — that always works.",
    });
  }

  // Happy path — feed the normalized JSON through the existing pipeline.
  return await runJsonPipeline(
    token,
    JSON.stringify(result.json),
    detected,
    ctx,
    parserPath,
    result.confidence === "low" ? undefined : result.confidence,
  );
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
    // eslint-disable-next-line no-console
    console.log("[upload-any] capture:create_import", {
      parserPath,
      importId,
    });
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
    // eslint-disable-next-line no-console
    console.log("[upload-any] capture:ok", { parserPath, importId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[upload-any] capture:failed", {
      parserPath,
      importId,
      message: (err as Error).message,
      code: err instanceof ImportRunnerError ? err.code : "UNKNOWN",
    });
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
        reviewFlags: [`JSON_${err.code}: ${err.message.slice(0, 200)}`],
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
      reviewFlags: [`JSON_CAPTURE_ERROR: ${(err as Error).message.slice(0, 200)}`],
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
    // eslint-disable-next-line no-console
    console.log("[upload-any] normalize:ok", {
      parserPath,
      importId,
      tradelineCount,
      candidateCount,
      bureaus: result.report.bureausDetected,
      warnings: result.report.validationWarnings,
    });
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
    // eslint-disable-next-line no-console
    console.error("[upload-any] normalize:failed", {
      parserPath,
      importId,
      code,
      message: (err as Error).message,
    });
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
      reviewFlags: [`${code}: ${(err as Error).message.slice(0, 200)}`],
      bureauGuess: null,
      detectedFormat,
      message: "We received your report. Our support team is reviewing it.",
    });
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
