import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  DeletionError,
  deleteImport,
  expectedImportConfirmation,
  isConfirmationOk,
  previewImportImpact,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

const DeleteZ = z.object({
  reason: z.string().min(10).max(2000),
  confirmation: z.string().min(1).max(200),
});

// Preview the delete impact without making any change. The UI calls this
// first to build the confirmation screen.
export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const impact = await previewImportImpact(id);
    return NextResponse.json({
      ...impact,
      expectedConfirmation: expectedImportConfirmation(id),
    });
  } catch (err) {
    if (err instanceof DeletionError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = DeleteZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isConfirmationOk(parsed.data.confirmation, expectedImportConfirmation(id))) {
    return NextResponse.json(
      {
        error: "CONFIRMATION_MISMATCH",
        message: `Confirmation phrase must be exactly: ${expectedImportConfirmation(id)}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await deleteImport({
      importId: id,
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
