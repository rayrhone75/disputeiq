import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// User confirms the AI-drafted letter. Locks the case and advances it to
// READY_FOR_PAYMENT. The Square checkout step then promotes it to PAID,
// the Square webhook enqueues dispatch-letter, and LetterStream takes over.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await fetchMutation(
      api.disputes.confirm,
      { id: id as Id<"disputeCases"> },
      { token },
    );
    return NextResponse.json({ ok: true, status: result.status });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (msg.includes("INVALID_STATE")) {
      const status = msg.split(":").pop();
      return NextResponse.json({ error: "INVALID_STATE", status }, { status: 409 });
    }
    if (msg.includes("NO_LETTER_ARTIFACT")) {
      return NextResponse.json({ error: "NO_LETTER_ARTIFACT" }, { status: 409 });
    }
    if (msg.includes("UNAUTHENTICATED")) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
