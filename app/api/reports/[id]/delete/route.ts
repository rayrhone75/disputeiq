import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Hard delete a report and all its tradelines. User can only delete their own.
// In Convex there is no cascade — the deleteReport mutation handles
// children inside a single (atomic) mutation.
// Does NOT affect disputes already created from those tradelines — they keep
// their tradelineId as a historical reference.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  try {
    const result = await fetchMutation(
      api.creditReports.deleteReport,
      { id: id as Id<"creditReports"> },
      { token: token ?? undefined },
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}
