import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth";
import { FetchImportZ } from "@/lib/credit-import/schemas";
import { fetchAndCapture, ImportRunnerError } from "@/lib/credit-import/runner";
import { ProviderFetchError } from "@/lib/credit-import/fetcher";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });

  const body = await req.json().catch(() => ({}));
  const parsed = FetchImportZ.safeParse({ ...body, importId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const imp = await fetchAndCapture(
      { token },
      {
        importId: id as Id<"creditReportImports">,
        url: parsed.data.url,
        cookieHeader: parsed.data.cookieHeader,
        bearerToken: parsed.data.bearerToken,
      },
    );
    return NextResponse.json({ import: imp });
  } catch (err) {
    if (err instanceof ProviderFetchError) {
      return NextResponse.json(
        { error: err.code, message: err.message, status: err.status },
        { status: 502 },
      );
    }
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
