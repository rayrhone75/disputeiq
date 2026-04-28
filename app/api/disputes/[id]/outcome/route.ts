import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Letter Checker — user confirms the outcome after a certified letter has been
// delivered and they've heard back from the bureau.
//
// removed  → DisputeCase.status = CLOSED, items considered handled
// failed   → DisputeCase.status = ESCALATION_READY (queued for re-dispute)
// partial  → stored as failed + note so the user can upload the bureau letter
const schema = z.object({
  outcome: z.enum(["removed", "failed", "partial"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    const result = await fetchMutation(
      api.disputes.recordOutcome,
      {
        id: id as Id<"disputeCases">,
        outcome: parsed.data.outcome,
        notes: parsed.data.notes,
      },
      { token },
    );
    return NextResponse.json({ ok: true, status: result.status });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
