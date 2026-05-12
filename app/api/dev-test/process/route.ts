import { NextRequest, NextResponse } from "next/server";
import {
  processCreditReport,
  MistralOcrError,
  ParalegalExtractionError,
  type ProcessInput,
} from "@/lib/credit-import/process-report";

// Dev-only extraction probe — runs the same Mistral OCR + paralegal +
// regex-override + adapter pipeline as the real /api/reports/upload-any
// route, but skips Clerk auth, Convex persistence, and dispute-engine
// candidate generation. Lets local testing happen without needing the
// rest of the backend wired up.
//
// Gated to non-production so this can't ship by accident.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DISABLED_IN_PRODUCTION" }, { status: 404 });
  }
  if (!process.env.MISTRAL_API_KEY) {
    return NextResponse.json(
      { error: "MISTRAL_API_KEY missing in .env.local" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "BAD_FORM", message: (err as Error).message },
      { status: 400 },
    );
  }
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Attach a file as `file`." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: "FILE_TOO_LARGE",
        message: `${(file.size / (1024 * 1024)).toFixed(1)} MB > 25 MB limit`,
      },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const lowerName = (file.name || "").toLowerCase();
  const looksPdf =
    buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
  const looksHtml =
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    file.type === "text/html";
  const looksJson =
    lowerName.endsWith(".json") || file.type === "application/json";

  const input: ProcessInput = looksPdf
    ? { format: "pdf", bytes: buf, filename: file.name || "report.pdf" }
    : looksHtml
    ? { format: "html", bytes: buf }
    : looksJson
    ? { format: "json", text: buf.toString("utf8") }
    : { format: "text", text: buf.toString("utf8") };

  const stages: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const t0 = Date.now();
  try {
    const out = await processCreditReport(input, {
      logStage: (event, data) => stages.push({ event, data }),
    });
    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - t0,
      input: { format: input.format, size: buf.length, filename: file.name },
      stages,
      result: {
        confidence: out.result.confidence,
        counts: out.result.counts,
        reasonCodes: out.result.reasonCodes,
        json: out.result.json,
      },
      extractedTextPreview: out.extractedText.slice(0, 2000),
      extractedTextLength: out.extractedText.length,
    });
  } catch (err) {
    if (err instanceof MistralOcrError) {
      return NextResponse.json(
        {
          ok: false,
          stage: "mistral-ocr",
          elapsedMs: Date.now() - t0,
          stages,
          error: {
            name: err.name,
            ocrStage: err.stage,
            status: err.status,
            body: err.body.slice(0, 1000),
          },
        },
        { status: 502 },
      );
    }
    if (err instanceof ParalegalExtractionError) {
      return NextResponse.json(
        {
          ok: false,
          stage: "paralegal",
          elapsedMs: Date.now() - t0,
          stages,
          error: {
            name: err.name,
            status: err.status,
            body: err.body.slice(0, 1000),
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        stage: "unknown",
        elapsedMs: Date.now() - t0,
        stages,
        error: (err as Error).message,
      },
      { status: 500 },
    );
  }
}
