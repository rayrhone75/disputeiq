import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DeletionError,
  deleteAllImportsForUser,
  expectedUserConfirmation,
  isConfirmationOk,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

const BodyZ = z.object({
  reason: z.string().min(10).max(2000),
  confirmation: z.string().min(1).max(200),
});

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = BodyZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!isConfirmationOk(parsed.data.confirmation, expectedUserConfirmation(target.email))) {
    return NextResponse.json(
      {
        error: "CONFIRMATION_MISMATCH",
        message: `Confirmation phrase must be exactly: ${expectedUserConfirmation(target.email)}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await deleteAllImportsForUser({
      userId: id,
      reason: parsed.data.reason,
      actorUserId: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DeletionError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
