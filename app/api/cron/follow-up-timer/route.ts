import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// Daily sweep: any DELIVERED or RESPONSE_RECEIVED dispute whose responseDueAt has
// elapsed is flipped to ESCALATION_READY so it shows up in the Ready-to-re-dispute
// and CFPB tiles on the dashboard rail. An audit log entry is written for every
// case that transitions.
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. If CRON_SECRET
// is unset (local dev) we accept any request.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const now = new Date();
  const overdue = await prisma.disputeCase.findMany({
    where: {
      responseDueAt: { lt: now },
      status: { in: ["DELIVERED", "RESPONSE_RECEIVED"] },
    },
    select: { id: true, userId: true, tradelineId: true, responseDueAt: true, status: true },
  });

  let transitioned = 0;
  for (const dc of overdue) {
    await prisma.disputeCase.update({
      where: { id: dc.id },
      data: { status: "ESCALATION_READY" },
    });
    await writeAuditLog({
      targetUserId: dc.userId,
      action: "AUTO_FOLLOW_UP_ELAPSED",
      entityType: "DisputeCase",
      entityId: dc.id,
      metadataJson: {
        previousStatus: dc.status,
        responseDueAt: dc.responseDueAt?.toISOString() ?? null,
        elapsedHours: dc.responseDueAt
          ? Math.round((now.getTime() - dc.responseDueAt.getTime()) / 3_600_000)
          : null,
      },
    });
    transitioned += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: overdue.length,
    transitioned,
    at: now.toISOString(),
  });
}
