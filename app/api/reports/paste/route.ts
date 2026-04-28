import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { parseReportText } from "@/lib/report-parser";

// Paste-text report import. User copies their MyFreeScoreIQ report text and
// pastes it here. We run the same parser pipeline as the PDF upload but skip
// the pdf-parse step since we already have raw text.
const schema = z.object({
  text: z.string().min(100, "Report text must be at least 100 characters.").max(500000),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const text = parsed.data.text;
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
