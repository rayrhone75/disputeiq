import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// User confirms the AI-drafted letter. Locks the case and advances it to
// READY_FOR_PAYMENT. The Square checkout step then promotes it to PAID,
// the Square webhook enqueues dispatch-letter, and LetterStream takes over.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await ctx.params;
  const dc = await prisma.disputeCase.findUnique({ where: { id } });
  if (!dc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (dc.userId !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (dc.status !== "DRAFT" && dc.status !== "NEEDS_USER_CONFIRMATION") {
    return NextResponse.json({ error: "INVALID_STATE", status: dc.status }, { status: 409 });
  }
  if (!dc.secureLetterRef) {
    return NextResponse.json({ error: "NO_LETTER_ARTIFACT" }, { status: 409 });
  }

  const updated = await prisma.disputeCase.update({
    where: { id },
    data: { status: "READY_FOR_PAYMENT", userConfirmedAt: new Date() },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "DISPUTE_CONFIRMED",
    entityType: "DisputeCase",
    entityId: id,
    metadataJson: {},
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
