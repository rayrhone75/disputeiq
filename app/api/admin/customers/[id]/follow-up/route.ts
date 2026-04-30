import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/follow-up — create a follow-up reminder.
// Body: { body: string, dueAt: number (unix ms) }

export const dynamic = "force-dynamic";

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
    dueAt?: unknown;
  };
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "body is required" },
      { status: 400 },
    );
  }
  if (typeof body.dueAt !== "number" || !Number.isFinite(body.dueAt)) {
    return NextResponse.json(
      { ok: false, code: "BAD_DUE_AT", message: "dueAt must be a number" },
      { status: 400 },
    );
  }
  try {
    const r = await fetchMutation(
      api.adminCustomers.addFollowUp,
      { customerId, body: body.body, dueAt: body.dueAt },
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
