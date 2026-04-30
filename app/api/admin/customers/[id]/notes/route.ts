import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// /api/admin/customers/:id/notes
//   GET  → list notes (most recent first)
//   POST → create a note  body: { body, category, pinned? }

export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "general",
  "billing",
  "escalation",
  "compliance",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;
  try {
    const notes = await fetchQuery(
      api.adminCustomers.notesForCustomer,
      { customerId },
      { token: convexToken },
    );
    return NextResponse.json({ ok: true, notes });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        notes: [],
      },
      { status: 200 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;

  const body = (await req.json().catch(() => ({}))) as {
    body?: unknown;
    category?: unknown;
    pinned?: unknown;
  };
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "body is required" },
      { status: 400 },
    );
  }
  if (typeof body.category !== "string" || !CATEGORIES.has(body.category)) {
    return NextResponse.json(
      { ok: false, code: "BAD_CATEGORY", message: "invalid category" },
      { status: 400 },
    );
  }
  try {
    const r = await fetchMutation(
      api.adminCustomers.addNote,
      {
        customerId,
        body: body.body,
        category: body.category as
          | "general"
          | "billing"
          | "escalation"
          | "compliance",
        pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
      },
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
