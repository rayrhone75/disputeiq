import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { parseReportPdf } from "@/lib/report-parser";
import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const sessionUser = await requireUser().catch(() => null);
  if (!sessionUser) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const userId = sessionUser.id;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const ref = await storage.put(`reports/${userId}/${hash}.pdf`, buf, "application/pdf");

  const report = await prisma.creditReport.create({
    data: {
      userId,
      source: "MANUAL_UPLOAD",
      pulledAt: new Date(),
      snapshotHash: hash,
      rawSecureRef: ref,
    },
  });

  const parsed = await parseReportPdf(buf);
  const tradelines = parsed.tradelines;
  if (tradelines.length) {
    await prisma.tradeline.createMany({
      data: tradelines.map((t) => ({
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
    targetUserId: userId,
    action: "REPORT_UPLOADED",
    entityType: "CreditReport",
    entityId: report.id,
    metadataJson: { hash, parsedCount: tradelines.length, reviewFlags: parsed.reviewFlags, bureauGuess: parsed.bureauGuess },
  });

  const signalCount = tradelines.reduce((n, t) => n + (t.signalSummary?.length ?? 0), 0);
  const parseStatus =
    tradelines.length > 0
      ? "parsed"
      : parsed.reviewFlags.length > 0
        ? "partial_needs_review"
        : "empty";

  return NextResponse.json({
    reportId: report.id,
    parsedCount: tradelines.length,
    signalCount,
    reviewFlags: parsed.reviewFlags,
    bureausDetected: parsed.bureausDetected ?? [],
    parseStatus,
  });
}
