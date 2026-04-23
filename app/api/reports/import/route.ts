import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createImport, ImportRunnerError } from "@/lib/credit-import/runner";

// Customer-facing import creation. A logged-in user creates a new
// CreditReportImport belonging to themselves. Default provider is
// IDENTITYIQ — users don't see legacy providers.
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const imp = await createImport({
      userId: user.id,
      provider: "IDENTITYIQ",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
      actorUserId: user.id,
    });
    return NextResponse.json({ import: imp });
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
