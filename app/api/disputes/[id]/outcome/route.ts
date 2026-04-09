import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Letter Checker — user confirms the outcome after a certified letter has been
// delivered and they've heard back from the bureau.
//
// removed  → DisputeCase.status = CLOSED, items considered handled
// failed   → DisputeCase.status = ESCALATION_READY (queued for re-dispute)
// partial  → stored as failed + note so the user can upload the bureau letter
const schema = z.object({
  outcome: z.enum(["removed", "failed", "partial"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const dc = await prisma.disputeCase.findUnique({ where: { id } });
  if (!dc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (dc.userId !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const nextStatus =
    parsed.data.outcome === "removed" ? "CLOSED" : "ESCALATION_READY";

  await prisma.disputeCase.update({
    where: { id },
    data: { status: nextStatus },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "DISPUTE_OUTCOME_RECORDED",
    entityType: "DisputeCase",
    entityId: id,
    metadataJson: { outcome: parsed.data.outcome, notes: parsed.data.notes ?? null },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
