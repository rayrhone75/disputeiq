import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const CategoryZ = z.enum(["general", "billing", "report", "escalation"]).default("general");

const CreateZ = z.object({
  userId: z.string().min(1),
  body: z.string().min(1).max(8000),
  category: CategoryZ.optional(),
  pinned: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const notes = await prisma.supportNote.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { email: true } } },
  });
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = CreateZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const note = await prisma.supportNote.create({
    data: {
      userId: parsed.data.userId,
      authorUserId: user.id,
      body: parsed.data.body,
      category: parsed.data.category ?? "general",
      pinned: !!parsed.data.pinned,
      isInternal: true,
    },
    include: { author: { select: { email: true } } },
  });
  await writeAuditLog({
    actorUserId: user.id,
    targetUserId: parsed.data.userId,
    action: "SUPPORT_NOTE_CREATED",
    entityType: "SupportNote",
    entityId: note.id,
    metadataJson: { category: note.category, pinned: note.pinned, length: note.body.length },
  });
  return NextResponse.json({ note });
}
