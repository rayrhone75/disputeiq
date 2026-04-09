import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeReport } from "@/lib/ai/analyze-report";
import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const report = await prisma.creditReport.findUnique({
    where: { id },
    include: { tradelines: true },
  });
  if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (report.userId !== user.id && user.role === "USER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = await analyzeReport(report.tradelines);

  await writeAuditLog({
    targetUserId: report.userId,
    actorUserId: user.id,
    action: "REPORT_ANALYZED",
    entityType: "CreditReport",
    entityId: report.id,
    metadataJson: { findings: result.findings.length, aiLive: result.aiLive },
  });

  return NextResponse.json(result);
}
