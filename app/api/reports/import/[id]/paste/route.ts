import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureRaw, ImportRunnerError } from "@/lib/credit-import/runner";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const bodyText = typeof body.bodyText === "string" ? body.bodyText : undefined;
  if (!bodyText) {
    return NextResponse.json(
      { error: "NO_BODY", message: "Paste the report JSON body first." },
      { status: 400 },
    );
  }
  try {
    const updated = await captureRaw(
      { token },
      {
        importId: id as Id<"creditReportImports">,
        bodyText,
        onlyIfOwnedByMe: true,
      },
    );
    return NextResponse.json({ import: updated });
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    if ((err as Error).message === "NOT_FOUND" || (err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
