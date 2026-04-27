import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createImport, ImportRunnerError } from "@/lib/credit-import/runner";

// Customer-facing import creation. A logged-in user creates a new
// CreditReportImport belonging to themselves. Default provider is MYSCOREIQ
// — the supported provider for new users. Legacy IDENTITYIQ + MFSN values
// remain in the schema enum so admin/support can read older rows, but they
// are not selectable from the customer flow.
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });

  const body = await req.json().catch(() => ({}));
  try {
    const imp = await createImport(
      { token },
      {
        provider: "MYSCOREIQ",
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
