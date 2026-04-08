import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Builds a timeline view of a dispute case from the case state + audit log.
// Read-only — no compliance gates required.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const dc = await prisma.disputeCase.findUnique({ where: { id } });
  if (!dc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "DisputeCase", entityId: id },
    orderBy: { createdAt: "asc" },
  });

  const events = [
    { at: dc.userConfirmedAt, label: "User confirmed", kind: "confirm" },
    { at: dc.mailedAt, label: "Mailed via certified mail", kind: "mailed" },
    { at: dc.deliveredAt, label: "Delivered", kind: "delivered" },
    { at: dc.responseDueAt, label: "Response due", kind: "due" },
  ].filter((e) => !!e.at);

  return NextResponse.json({
    case: {
      id: dc.id,
      status: dc.status,
      letterType: dc.letterType,
      aiReasonSummary: dc.aiReasonSummary,
    },
    events,
    auditLog: logs.map((l) => ({
      at: l.createdAt,
      action: l.action,
      metadata: l.metadataJson,
    })),
  });
}
