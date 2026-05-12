import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import type { Id } from "@/convex/_generated/dataModel";
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
} from "@/lib/credit-import/process-report";

// Paste-text report import.
//
// Sniffs whether the body looks like JSON (`{` or `[` prefix) and
// routes accordingly:
//   - JSON  → processCreditReport with format=json (paralegal still
//             runs to normalize whatever shape the customer pasted —
//             we no longer trust the raw payload to match the adapter).
//   - text  → processCreditReport with format=text.
//
// Output is fed through the same createImport → captureRaw →
// runNormalization pipeline as the upload-any route, so the customer
// sees identical results regardless of how they got the report in.

const schema = z.object({
  text: z
    .string()
    .min(100, "Report text must be at least 100 characters.")
    .max(25 * 1024 * 1024),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId)
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  // Same preflight as upload-any: surface server-config errors instead
  // of silently failing downstream.
  if ((process.env.ENCRYPTION_KEY ?? "").length < 32) {
    return NextResponse.json(
      {
        error: "MISSING_ENCRYPTION_KEY",
        parseStatus: "needs_manual_review",
        message:
          "Server configuration error (ENCRYPTION_KEY missing). Please contact support.",
      },
      { status: 503 },
    );
  }
  if (!process.env.MISTRAL_API_KEY) {
    return NextResponse.json(
      {
        error: "MISSING_MISTRAL_API_KEY",
        parseStatus: "needs_manual_review",
        message:
          "Server configuration error (MISTRAL_API_KEY missing). Please contact support.",
      },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const text = parsed.data.text;
  const trimmed = text.trim();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  // ── Processing (Mistral paralegal) ──────────────────────────────────
  let processOutcome;
  try {
    processOutcome = await processCreditReport(
      looksJson
        ? { format: "json", text: trimmed }
        : { format: "text", text },
      {
        logStage: (event, data) => {
          // eslint-disable-next-line no-console
          console.log(`[paste] process:${event}`, data ?? {});
        },
      },
    );
  } catch (err) {
    if (err instanceof MistralOcrError) {
      return NextResponse.json(
        {
          reportId: null,
          parsedCount: 0,
          reviewFlags: [`MISTRAL_OCR_${err.stage.toUpperCase()}_FAILED`],
          bureauGuess: null,
          parseStatus: "needs_manual_review",
          error: "OCR_FAILED",
          message: "Mistral OCR didn't accept this content.",
        },
        { status: 502 },
      );
    }
    if (err instanceof ParalegalExtractionError) {
      return NextResponse.json(
        {
          reportId: null,
          parsedCount: 0,
          reviewFlags: ["PARALEGAL_EXTRACTION_FAILED"],
          bureauGuess: null,
          parseStatus: "needs_manual_review",
          error: "PARALEGAL_FAILED",
          message:
            "We received your text but couldn't structure the data. Please try again or contact support.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        reportId: null,
        parsedCount: 0,
        reviewFlags: ["PROCESS_FAILED"],
        bureauGuess: null,
        parseStatus: "needs_manual_review",
        error: "PROCESS_FAILED",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }

  const { result } = processOutcome;

  if (result.counts.tradelines === 0) {
    return NextResponse.json({
      reportId: null,
      parsedCount: 0,
      reviewFlags: result.reasonCodes,
      bureauGuess: null,
      parseStatus: "needs_manual_review",
      message:
        "We couldn't find a credit report in the text you pasted. Try pasting the full JSON from your MyScoreIQ tab.",
    });
  }

  // ── Persist via the runner pipeline ────────────────────────────────
  let importId: Id<"creditReportImports"> | null = null;
  try {
    const created = await createImport(
      { token },
      { provider: "MYSCOREIQ", sourceUrl: undefined },
    );
    importId =
      (created as { _id: Id<"creditReportImports"> } | null)?._id ?? null;
    if (!importId) {
      return NextResponse.json(
        {
          reportId: null,
          parsedCount: 0,
          reviewFlags: ["CREATE_RETURNED_NULL"],
          bureauGuess: null,
          parseStatus: "needs_manual_review",
          error: "CREATE_FAILED",
          message:
            "Could not create the import row. Try again or contact support.",
        },
        { status: 500 },
      );
    }
    await captureRaw(
      { token },
      {
        importId,
        bodyText: JSON.stringify(result.json),
        onlyIfOwnedByMe: true,
      },
    );
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json(
        {
          reportId: null,
          parsedCount: 0,
          reviewFlags: [`PASTE_${err.code}`],
          bureauGuess: null,
          parseStatus: "needs_manual_review",
          error: err.code,
          message: err.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        reportId: null,
        parsedCount: 0,
        reviewFlags: ["PASTE_CAPTURE_ERROR"],
        bureauGuess: null,
        parseStatus: "needs_manual_review",
        error: "CAPTURE_ERROR",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }

  try {
    const normalized = await runNormalization({ token }, { importId });
    return NextResponse.json({
      reportId: importId,
      parsedCount: normalized.report.tradelines.length,
      reviewFlags: normalized.report.validationWarnings,
      bureauGuess: normalized.report.bureausDetected[0] ?? null,
      parseStatus:
        normalized.report.tradelines.length > 0
          ? "parsed"
          : "needs_manual_review",
      redirectTo: "/dashboard/get-report?imported=1",
    });
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "PASTE_NORMALIZE_ERROR";
    return NextResponse.json({
      reportId: importId,
      parsedCount: 0,
      reviewFlags: [code],
      bureauGuess: null,
      parseStatus: "needs_manual_review",
      message:
        "Your file was uploaded but our parser couldn't analyze it automatically. Support will review it shortly.",
      redirectTo: "/dashboard/get-report?imported=1",
    });
  }
}
