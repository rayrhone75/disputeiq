import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// POST /api/messages/threads/:id/escalate → admin only.
// Body: { escalated: boolean }.

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { escalated?: unknown };
  if (typeof body.escalated !== "boolean") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY" },
      { status: 400 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN" },
        { status: 200 },
      );
    }
    const r = await fetchMutation(
      api.messages.setEscalated,
      {
        threadId: id as unknown as Id<"messageThreads">,
        escalated: body.escalated,
      },
      { token },
    );
    return NextResponse.json(r);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, code: "ACTION_FAILED", message: msg },
      { status: 200 },
    );
  }
}
