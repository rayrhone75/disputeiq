import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// POST /api/messages/threads/:id/messages → append message.
// Body: { body }. Role inferred from session.

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
  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "body is required" },
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
      api.messages.sendMessage,
      {
        threadId: id as unknown as Id<"messageThreads">,
        body: body.body,
      },
      { token },
    );
    return NextResponse.json(r);
  } catch (err) {
    const msg = (err as Error).message;
    const code = msg.includes("FORBIDDEN")
      ? "FORBIDDEN"
      : msg.includes("THREAD_NOT_FOUND")
        ? "NOT_FOUND"
        : "ACTION_FAILED";
    return NextResponse.json(
      { ok: false, code, message: msg },
      { status: code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 200 },
    );
  }
}
