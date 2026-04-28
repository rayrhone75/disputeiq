import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { storage } from "@/lib/storage";
import { parseReportPdf } from "@/lib/report-parser";

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const ref = await storage.put(`reports/${userId}/${hash}.pdf`, buf, "application/pdf");

  const parsed = await parseReportPdf(buf);
  const tradelines = parsed.tradelines;

  const created = await fetchMutation(
    api.creditReports.createReport,
    {
      source: "MANUAL_UPLOAD",
      snapshotHash: hash,
      rawSecureRef: ref,
      tradelines: tradelines.map((t) => ({
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
      auditAction: "REPORT_UPLOADED",
      auditMetadataJson: {
        hash,
        parsedCount: tradelines.length,
        reviewFlags: parsed.reviewFlags,
        bureauGuess: parsed.bureauGuess,
      },
    },
    { token: token ?? undefined },
  );

  const signalCount = tradelines.reduce((n, t) => n + (t.signalSummary?.length ?? 0), 0);
  const parseStatus =
    tradelines.length > 0
      ? "parsed"
      : parsed.reviewFlags.length > 0
        ? "partial_needs_review"
        : "empty";

  return NextResponse.json({
    reportId: created.id,
    parsedCount: tradelines.length,
    signalCount,
    reviewFlags: parsed.reviewFlags,
    bureausDetected: parsed.bureausDetected ?? [],
    parseStatus,
  });
}
