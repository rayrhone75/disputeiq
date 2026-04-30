import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseReportText } from "@/lib/report-parser";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";

// Paste-text report import.
//
// Two input shapes are accepted:
//
//   1. **JSON** (modern path) — body starts with `{` or `[`. Most likely a
//      MyScoreIQ / IdentityIQ JSON report copied from the customer's
//      authenticated tab. Routes through the credit-import runner
//      pipeline (createImport → captureRaw → runNormalization) so it
//      lands in `creditReportImports` and produces dispute candidates.
//      Same code path the new ConnectReportPanel clipboard auto-import
//      uses, so the customer gets identical behavior whether they paste
//      here or click Connect on /dashboard/get-report.
//
//   2. **Plain text** (legacy path) — anything else. Runs the heuristic
//      tri-merge text parser (lib/report-parser.ts) used for
//      PDF-extracted text. Lands in legacy `creditReports`.
//
// We pick by sniffing the trimmed body's first character. JSON detection
// fails closed: if `JSON.parse` throws, we fall back to the text parser.

// 25 MB matches the bookmarklet relay cap. MyScoreIQ tri-merge JSONs
// can exceed 2 MB easily; the prior limit silently rejected the manual
// upload path.
const schema = z.object({
  text: z
    .string()
    .min(100, "Report text must be at least 100 characters.")
    .max(25 * 1024 * 1024),
});

// Explicit route segment config — large JSON bodies + Convex round-trips
// can take longer than Vercel's 10s default. Without these, big imports
// silently 504.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const text = parsed.data.text;
  const trimmed = text.trim();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  // ── Modern JSON path ────────────────────────────────────────────────
  if (looksJson) {
    try {
      JSON.parse(trimmed);
    } catch {
      // Falls through to text path below — the body sniff was a false
      // positive (e.g. weird MyScoreIQ block that starts with `{` but
      // isn't JSON). Don't fail; let the heuristic parser try.
      return await pasteAsLegacyText(token, text);
    }
    // Three steps that can each fail independently. We split the try/
    // catch so a normalize failure doesn't bury the fact that the file
    // IS in the database — admins can still recover. Two error classes:
    //   1. createImport / captureRaw fails → 400, no reportId.
    //   2. runNormalization fails → 200 with parseStatus="needs_manual_review"
    //      and reportId set, so the import is still recoverable.
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
            message: "Could not create the import row. Try again or contact support.",
          },
          { status: 500 },
        );
      }
      await captureRaw(
        { token },
        { importId, bodyText: trimmed, onlyIfOwnedByMe: true },
      );
    } catch (err) {
      if (err instanceof ImportRunnerError) {
        return NextResponse.json(
          {
            reportId: null,
            parsedCount: 0,
            reviewFlags: [`JSON_${err.code}`],
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
          reviewFlags: ["JSON_CAPTURE_ERROR"],
          bureauGuess: null,
          parseStatus: "needs_manual_review",
          error: "CAPTURE_ERROR",
          message: (err as Error).message,
        },
        { status: 500 },
      );
    }

    // Normalization step — failures here are RECOVERABLE. We return 200
    // with the importId so the customer's dashboard shows the import
    // and support can re-run normalization later.
    try {
      const result = await runNormalization({ token }, { importId });
      return NextResponse.json({
        reportId: importId,
        parsedCount: result.report.tradelines.length,
        reviewFlags: result.report.validationWarnings,
        bureauGuess: result.report.bureausDetected[0] ?? null,
        parseStatus:
          result.report.tradelines.length > 0
            ? "parsed"
            : "needs_manual_review",
        redirectTo: "/dashboard/get-report?imported=1",
      });
    } catch (err) {
      const code =
        err instanceof ImportRunnerError ? err.code : "JSON_NORMALIZE_ERROR";
      // Return 200 (not 4xx/5xx) — the file is uploaded, just not
      // analyzed. The dashboard will show "needs review" cleanly.
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

  // ── Legacy plain-text path ──────────────────────────────────────────
  return await pasteAsLegacyText(token, text);
}

async function pasteAsLegacyText(token: string | null, text: string) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const result = parseReportText(text);

  const created = await fetchMutation(
    api.creditReports.createReport,
    {
      source: "MANUAL_UPLOAD",
      snapshotHash: hash,
      tradelines: result.tradelines.map((t) => ({
        bureau: t.bureau,
        creditorName: t.creditorName,
        accountRefMasked: t.accountRefMasked,
        balanceCents: t.balanceCents,
        pastDueCents: t.pastDueCents,
        statusLabel: t.statusLabel,
        openedAtMs: t.openedAt instanceof Date ? t.openedAt.getTime() : undefined,
        lastReportedAtMs:
          t.lastReportedAt instanceof Date ? t.lastReportedAt.getTime() : undefined,
        lastActivityAtMs:
          t.lastActivityAt instanceof Date ? t.lastActivityAt.getTime() : undefined,
        isCollection: t.isCollection ?? false,
        isMedical: t.isMedical ?? false,
      })),
      auditAction: "REPORT_PASTED",
      auditMetadataJson: {
        hash,
        textLength: text.length,
        parsedCount: result.tradelines.length,
        reviewFlags: result.reviewFlags,
        bureauGuess: result.bureauGuess,
      },
    },
    { token: token ?? undefined },
  );

  return NextResponse.json({
    reportId: created.id,
    parsedCount: result.tradelines.length,
    reviewFlags: result.reviewFlags,
    bureauGuess: result.bureauGuess,
    parseStatus: result.tradelines.length > 0 ? "parsed" : "needs_manual_review",
  });
}
