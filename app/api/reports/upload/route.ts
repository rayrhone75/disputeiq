import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
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
} from "@/lib/credit-import/process-report";

// Legacy /api/reports/upload — PDF-only entry point.
//
// Now routed through the same Mistral OCR + paralegal pipeline as
// /api/reports/upload-any so it produces real creditReportImports rows
// and dispute candidates instead of writing to the deprecated
// creditReports table. This means uploads here become visible on
// /dashboard/get-report alongside everything else.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId)
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  if ((process.env.ENCRYPTION_KEY ?? "").length < 32) {
    return NextResponse.json(
      { error: "MISSING_ENCRYPTION_KEY" },
      { status: 503 },
    );
  }
  if (!process.env.MISTRAL_API_KEY) {
    return NextResponse.json(
      { error: "MISSING_MISTRAL_API_KEY" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex");

  // Best-effort archival of the original PDF bytes.
  try {
    await storage.put(
      `reports/${userId}/${hash}.pdf`,
      buf,
      "application/pdf",
    );
  } catch {
    // Non-fatal.
  }

  let processed;
  try {
    processed = await processCreditReport(
      { format: "pdf", bytes: buf, filename: file.name || "report.pdf" },
      {
        logStage: (event, data) => {
          // eslint-disable-next-line no-console
          console.log(`[upload] process:${event}`, data ?? {});
        },
      },
    );
  } catch (err) {
    const flag =
      err instanceof MistralOcrError
        ? `MISTRAL_OCR_${err.stage.toUpperCase()}_FAILED`
        : err instanceof ParalegalExtractionError
        ? "PARALEGAL_EXTRACTION_FAILED"
        : "PROCESS_FAILED";
    return NextResponse.json(
      {
        reportId: null,
        parsedCount: 0,
        reviewFlags: [flag],
        bureausDetected: [],
        parseStatus: "needs_manual_review",
        message: (err as Error).message,
      },
      { status: 502 },
    );
  }

  if (processed.result.counts.tradelines === 0) {
    return NextResponse.json({
      reportId: null,
      parsedCount: 0,
      reviewFlags: processed.result.reasonCodes,
      bureausDetected: [],
      parseStatus: "needs_manual_review",
      message:
        "We couldn't find a credit report in this PDF. Try uploading the JSON version from MyScoreIQ.",
    });
  }

  // Persist via the new pipeline.
  let importId: Id<"creditReportImports"> | null = null;
  try {
    const created = await createImport(
      { token },
      { provider: "MYSCOREIQ", sourceUrl: undefined },
    );
    importId =
      (created as { _id: Id<"creditReportImports"> } | null)?._id ?? null;
    if (!importId) throw new Error("createImport returned null");
    await captureRaw(
      { token },
      {
        importId,
        bodyText: JSON.stringify(processed.result.json),
        onlyIfOwnedByMe: true,
      },
    );
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "UPLOAD_CAPTURE_ERROR";
    return NextResponse.json(
      {
        reportId: importId,
        parsedCount: 0,
        reviewFlags: [code],
        bureausDetected: [],
        parseStatus: "needs_manual_review",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }

  try {
    const result = await runNormalization({ token }, { importId });
    const tradelines = result.report.tradelines;
    return NextResponse.json({
      reportId: importId,
      parsedCount: tradelines.length,
      signalCount: 0,
      reviewFlags: result.report.validationWarnings,
      bureausDetected: result.report.bureausDetected,
      parseStatus: tradelines.length > 0 ? "parsed" : "needs_manual_review",
    });
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "UPLOAD_NORMALIZE_ERROR";
    return NextResponse.json({
      reportId: importId,
      parsedCount: 0,
      reviewFlags: [code],
      bureausDetected: [],
      parseStatus: "needs_manual_review",
      message:
        "Your file was uploaded but our parser couldn't analyze it. Support will review it shortly.",
    });
  }
}
