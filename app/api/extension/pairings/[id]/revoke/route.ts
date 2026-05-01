import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// POST /api/extension/pairings/:id/revoke — fail-soft wrapper around
// `api.extensionPairings.revokeMine`. Same reasoning as the list
// endpoint: the dashboard card needs a normal fetch surface so a
// Convex blip never crashes the React tree.

export const dynamic = "force-dynamic";

export async function POST(
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
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN" },
        { status: 200 },
      );
    }
    const r = await fetchMutation(
      api.extensionPairings.revokeMine,
      { id: id as unknown as Id<"extensionPairings"> },
      { token },
    );
    return NextResponse.json(r);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, code: "ACTION_FAILED", message: msg },
      { status: 200 },
    );
  }
}
