import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseReportText } from "@/lib/report-parser";
import { writeAuditLog } from "@/lib/audit";

// Paste-text report import. User copies their MyFreeScoreIQ report text and
// pastes it here. We run the same parser pipeline as the PDF upload but skip
// the pdf-parse step since we already have raw text.
const schema = z.object({
  text: z.string().min(100, "Report text must be at least 100 characters.").max(500000),
});

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const text = parsed.data.text;
  const hash = crypto.createHash("sha256").update(text).digest("hex");

  const result = parseReportText(text);

  const report = await prisma.creditReport.create({
    data: {
      userId: user.id,
      source: "MANUAL_UPLOAD",
      pulledAt: new Date(),
      snapshotHash: hash,
      rawSecureRef: null,
    },
  });

  if (result.tradelines.length > 0) {
    await prisma.tradeline.createMany({
      data: result.tradelines.map((t) => ({
        reportId: report.id,
        bureau: t.bureau,
        creditorName: t.creditorName,
        accountRefMasked: t.accountRefMasked,
        balanceCents: t.balanceCents,
        pastDueCents: t.pastDueCents,
        statusLabel: t.statusLabel,
        openedAt: t.openedAt,
        lastReportedAt: t.lastReportedAt,
        lastActivityAt: t.lastActivityAt,
        isCollection: t.isCollection ?? false,
        isMedical: t.isMedical ?? false,
      })),
    });
  }

  await writeAuditLog({
    targetUserId: user.id,
    action: "REPORT_PASTED",
    entityType: "CreditReport",
    entityId: report.id,
    metadataJson: {
      hash,
      textLength: text.length,
      parsedCount: result.tradelines.length,
      reviewFlags: result.reviewFlags,
      bureauGuess: result.bureauGuess,
    },
  });

  return NextResponse.json({
    reportId: report.id,
    parsedCount: result.tradelines.length,
    reviewFlags: result.reviewFlags,
    bureauGuess: result.bureauGuess,
    parseStatus: result.tradelines.length > 0 ? "parsed" : "needs_manual_review",
  });
}
