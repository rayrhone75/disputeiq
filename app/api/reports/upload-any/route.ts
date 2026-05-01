import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
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

type SuccessShape = {
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
  const { userId, getToken } = await auth();

  // Build the logging context as soon as we know who we are. Filled in
  // further once the file is parsed; passed to every helper so each
  // return point records exactly one importHealthEvents row.
  const ctx: UploadCtx = {
    clerkUserId: userId ?? null,
    fileName: null,
    fileSize: null,
    format: "unknown",
  };

  if (!userId) {
    recordEvent(ctx, {
      parserPath: "rejected",
      ok: false,
      parseStatus: "rejected",
      errorMessage: "UNAUTHENTICATED",
    });
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const token = (await getToken({ template: "convex" })) ?? null;

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
      { error: "BAD_FORM", message: (err as Error).message },
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
      { error: "BAD_REQUEST", message: "Attach a file as `file`." },
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

  // Fall back to legacy heuristic write so /dashboard/reports has rows
  // and support can review. Also call createImport+captureRaw so the
  // import is visible in the new pipeline (FAILED state, but visible).
  const legacyId = await writeLegacyText(token, parsedPdf, pdfRef);
  await captureForReview(token, parsedPdf.text || "", "MYSCOREIQ_PDF");

  const pdfParseStatus =
    parsedPdf.tradelines.length > 0 ? "parsed" : "needs_manual_review";
  recordEvent(ctx, {
    parserPath: "pdf-heuristic",
    ok: true,
    parseStatus: pdfParseStatus,
    tradelineCount: parsedPdf.tradelines.length,
  });
  return jsonResponse({
    reportId: legacyId,
    parsedCount: parsedPdf.tradelines.length,
    parseStatus: pdfParseStatus,
    reviewFlags: parsedPdf.reviewFlags,
    bureauGuess: parsedPdf.bureauGuess ?? null,
    detectedFormat: "pdf",
    message:
      parsedPdf.tradelines.length > 0
        ? `We extracted ${parsedPdf.tradelines.length} tradelines from your PDF. Support will verify and any missing items will be added shortly.`
        : "We received your PDF. Our parser couldn't auto-extract tradelines from this layout — support will review it within one business day.",
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
      reportId: null,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: ["JSON_INVALID"],
      bureauGuess: null,
      detectedFormat,
      message: `JSON is malformed: ${(err as Error).message.slice(0, 140)}`,
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
      return jsonResponse(
        {
          reportId: null,
          parsedCount: 0,
          parseStatus: "needs_manual_review",
          reviewFlags: ["CREATE_RETURNED_NULL"],
          bureauGuess: null,
          detectedFormat,
          message:
            "Could not create the import row. Try again or contact support.",
        },
        500,
      );
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
      return jsonResponse(
        {
          reportId: null,
          parsedCount: 0,
          parseStatus: "needs_manual_review",
          reviewFlags: [`JSON_${err.code}`],
          bureauGuess: null,
          detectedFormat,
          message: err.message,
        },
        400,
      );
    }
    recordEvent(ctx, {
      parserPath,
      ok: false,
      parseStatus: "needs_manual_review",
      errorMessage: `JSON_CAPTURE_ERROR: ${(err as Error).message.slice(0, 200)}`,
    });
    return jsonResponse(
      {
        reportId: null,
        parsedCount: 0,
        parseStatus: "needs_manual_review",
        reviewFlags: ["JSON_CAPTURE_ERROR"],
        bureauGuess: null,
        detectedFormat,
        message: (err as Error).message,
      },
      500,
    );
  }

  try {
    const result = await runNormalization({ token }, { importId });
    const parseStatus =
      result.report.tradelines.length > 0 ? "parsed" : "needs_manual_review";
    recordEvent(ctx, {
      parserPath,
      ok: true,
      parseStatus,
      tradelineCount: result.report.tradelines.length,
      candidateCount: result.candidatesCreated,
    });
    return jsonResponse({
      reportId: importId as unknown as string,
      parsedCount: result.report.tradelines.length,
      parseStatus,
      reviewFlags: result.report.validationWarnings,
      bureauGuess: result.report.bureausDetected[0] ?? null,
      detectedFormat,
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
      reportId: importId as unknown as string,
      parsedCount: 0,
      parseStatus: "needs_manual_review",
      reviewFlags: [code],
      bureauGuess: null,
      detectedFormat,
      message:
        "Your file was uploaded but our parser couldn't analyze it automatically. Support will review it shortly.",
    });
  }
}

// ── Text path ────────────────────────────────────────────────────────────
async function runTextOrEmbeddedJson(
  token: string | null,
  text: string,
  detectedFormat: DetectedFormat,
  ctx: UploadCtx,
  fallbackParserPath: ParserPath,
): Promise<NextResponse> {
  // Try embedded JSON first. Some MyScoreIQ exports include it inline.
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

  // Heuristic text parse → legacy table.
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
  await captureForReview(token, text, "MYSCOREIQ_TEXT");

  const parseStatus =
    result.tradelines.length > 0 ? "parsed" : "needs_manual_review";
  recordEvent(ctx, {
    parserPath: fallbackParserPath,
    ok: true,
    parseStatus,
    tradelineCount: result.tradelines.length,
  });
  return jsonResponse({
    reportId: legacyId,
    parsedCount: result.tradelines.length,
    parseStatus,
    reviewFlags: result.reviewFlags,
    bureauGuess: result.bureauGuess ?? null,
    detectedFormat,
    message:
      result.tradelines.length > 0
        ? `We extracted ${result.tradelines.length} tradelines from your file. Support will verify and any missing items will be added shortly.`
        : "We received your file. Our parser couldn't auto-extract tradelines from this format — support will review it within one business day.",
  });
}

// ── Legacy creditReports writer ─────────────────────────────────────────
async function writeLegacyText(
  token: string | null,
  parsed: Pick<ParseResult, "tradelines" | "reviewFlags" | "bureauGuess">,
  rawSecureRef: string | undefined,
): Promise<string> {
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
  return created.id as string;
}

// Best-effort capture into the new pipeline so admins can see the file
// even when normalization can't run. Failures here are non-fatal — the
// legacy creditReports row is still the source of truth for parsed
// tradelines in this branch.
async function captureForReview(
  token: string | null,
  bodyText: string,
  reasonTag: string,
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
  } catch {
    // Non-fatal.
  }
}

function jsonResponse(body: SuccessShape, status = 200): NextResponse {
  return NextResponse.json(
    {
      ...body,
      redirectTo: body.redirectTo ?? "/dashboard/get-report?imported=1",
    },
    { status },
  );
}
