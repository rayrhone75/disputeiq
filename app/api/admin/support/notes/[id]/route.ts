import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const existing = await prisma.supportNote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.supportNote.delete({ where: { id } });
  await writeAuditLog({
    actorUserId: user.id,
    targetUserId: existing.userId,
    action: "SUPPORT_NOTE_DELETED",
    entityType: "SupportNote",
    entityId: id,
    metadataJson: { category: existing.category },
  });
  return NextResponse.json({ deleted: true });
}
