import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// /api/admin/customers/:id/notes/:noteId
//   PATCH  → edit (body / category / pinned)
//   DELETE → remove

export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "general",
  "billing",
  "escalation",
  "compliance",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken } = gate.ctx;

  const body = (await req.json().catch(() => ({}))) as {
    body?: unknown;
    category?: unknown;
    pinned?: unknown;
  };
  const args: {
    noteId: Id<"customerNotes">;
    body?: string;
    category?: "general" | "billing" | "escalation" | "compliance";
    pinned?: boolean;
  } = { noteId: noteId as unknown as Id<"customerNotes"> };
  if (typeof body.body === "string") args.body = body.body;
  if (typeof body.category === "string" && CATEGORIES.has(body.category)) {
    args.category = body.category as typeof args.category;
  }
  if (typeof body.pinned === "boolean") args.pinned = body.pinned;
  try {
    const r = await fetchMutation(api.adminCustomers.editNote, args, {
      token: convexToken,
    });
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "ACTION_FAILED",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken } = gate.ctx;
  try {
    const r = await fetchMutation(
      api.adminCustomers.deleteNote,
      { noteId: noteId as unknown as Id<"customerNotes"> },
      { token: convexToken },
    );
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "ACTION_FAILED",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }
}
