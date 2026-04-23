import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRaw, ImportRunnerError } from "@/lib/credit-import/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const imp = await prisma.creditReportImport.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const bodyText = typeof body.bodyText === "string" ? body.bodyText : undefined;
  if (!bodyText) {
    return NextResponse.json(
      { error: "NO_BODY", message: "Paste the report JSON body first." },
      { status: 400 },
    );
  }
  try {
    const updated = await captureRaw({ importId: id, bodyText, actorUserId: user.id });
    return NextResponse.json({ import: updated });
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
