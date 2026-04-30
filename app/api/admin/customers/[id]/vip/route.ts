import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/vip — toggle the VIP flag.
// Body: { vip: boolean }

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;

  const body = (await req.json().catch(() => ({}))) as { vip?: unknown };
  if (typeof body.vip !== "boolean") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "vip must be boolean" },
      { status: 400 },
    );
  }
  try {
    const result = await fetchMutation(
      api.adminCustomers.setVip,
      { customerId, vip: body.vip },
      { token: convexToken },
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, code: "ACTION_FAILED", message: (err as Error).message },
      { status: 200 },
    );
  }
}
