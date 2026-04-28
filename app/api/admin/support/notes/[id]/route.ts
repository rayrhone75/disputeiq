import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await fetchMutation(
      api.support.deleteNote,
      { id: id as Id<"supportNotes"> },
      { token },
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
