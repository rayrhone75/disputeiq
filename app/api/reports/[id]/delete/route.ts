import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Hard delete a report and all its tradelines. User can only delete their own.
// Tradelines cascade-delete via the Prisma schema (onDelete: Cascade).
// Does NOT affect disputes already created from those tradelines — they keep
// their tradelineId as a historical reference (nullable FK).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const report = await prisma.creditReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (report.userId !== user.id && user.role === "USER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const tradelineCount = await prisma.tradeline.count({ where: { reportId: id } });

  // Cascade: tradelines are deleted by Prisma's onDelete: Cascade on the FK.
  await prisma.creditReport.delete({ where: { id } });

  await writeAuditLog({
    targetUserId: report.userId,
    actorUserId: user.id,
    action: "REPORT_DELETED",
    entityType: "CreditReport",
    entityId: id,
    metadataJson: { tradelineCount, source: report.source },
  });

  return NextResponse.json({ ok: true, deletedTradelines: tradelineCount });
}
