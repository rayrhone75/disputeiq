import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { RunNormalizationZ } from "@/lib/credit-import/schemas";
import { runNormalization, ImportRunnerError } from "@/lib/credit-import/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = RunNormalizationZ.safeParse({ ...body, importId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await runNormalization({
      importId: id,
      replace: parsed.data.replace,
      actorUserId: user.id,
    });
    return NextResponse.json({
      candidatesCreated: result.candidatesCreated,
      bureausDetected: result.report.bureausDetected,
      tradelineCount: result.report.tradelines.length,
      inquiryCount: result.report.inquiries.length,
      collectionCount: result.report.collections.length,
      publicRecordCount: result.report.publicRecords.length,
      scoreCount: result.report.scores.length,
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
