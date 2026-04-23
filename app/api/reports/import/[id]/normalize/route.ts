import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runNormalization, ImportRunnerError } from "@/lib/credit-import/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const imp = await prisma.creditReportImport.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const result = await runNormalization({
      importId: id,
      replace: true,
      actorUserId: user.id,
    });
    return NextResponse.json({
      bureausDetected: result.report.bureausDetected,
      tradelineCount: result.report.tradelines.length,
      inquiryCount: result.report.inquiries.length,
      collectionCount: result.report.collections.length,
      publicRecordCount: result.report.publicRecords.length,
      candidatesCreated: result.candidatesCreated,
      validationWarnings: result.report.validationWarnings,
    });
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
