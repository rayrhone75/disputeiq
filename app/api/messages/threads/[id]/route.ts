import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// GET /api/messages/threads/:id → fetch thread + messages.
// Access enforced inside Convex (customer must own; admin allowed).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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
  if (!id) {
    return NextResponse.json(
      { ok: false, code: "BAD_ID" },
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
    const data = await fetchQuery(
      api.messages.getThread,
      { threadId: id as unknown as Id<"messageThreads"> },
      { token },
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
    }
    if (msg.includes("THREAD_NOT_FOUND")) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, code: "LOAD_FAILED", message: msg },
      { status: 200 },
    );
  }
}
