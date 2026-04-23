import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  DeletionError,
  expectedPurgeConfirmation,
  expectedUserConfirmation,
  previewUserImpact,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const impact = await previewUserImpact(id);
    return NextResponse.json({
      ...impact,
      expectedConfirmation: {
        archive: expectedUserConfirmation(impact.user.email),
        purge: expectedPurgeConfirmation(impact.user.email),
      },
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
