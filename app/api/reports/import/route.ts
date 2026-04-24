import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createImport, ImportRunnerError } from "@/lib/credit-import/runner";

// Customer-facing import creation. A logged-in user creates a new
// CreditReportImport belonging to themselves. Default provider is
// IDENTITYIQ — users don't see legacy providers.
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  const body = await req.json().catch(() => ({}));
  try {
    const imp = await createImport(
      { token },
      {
        provider: "IDENTITYIQ",
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
      },
    );
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
