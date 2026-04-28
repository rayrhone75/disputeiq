import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

// Customer-scoped import detail. Only returns data for imports that belong
// to the authenticated user.
export async function GET(_req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  const result = await fetchQuery(
    api.creditImports.getOwnedImport,
    { id: id as Id<"creditReportImports"> },
    { token: token ?? undefined },
  );
  if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    import: {
      ...result.import,
      normalized: result.normalized,
      _count: result.counts,
    },
  });
}
