import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runNormalization, ImportRunnerError } from "@/lib/credit-import/runner";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  try {
    const result = await runNormalization(
      { token },
      { importId: id as Id<"creditReportImports"> },
    );
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
