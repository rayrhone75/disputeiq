import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// GET /api/admin/customers/:id/threads → list a customer's threads (admin only).
// Used by the Customer 360 MessagesPanel and also called as a refresh
// after sending/marking/resolving.

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;
  try {
    const threads = await fetchQuery(
      api.messages.listThreadsForCustomer,
      { customerId },
      { token: convexToken },
    );
    return NextResponse.json({ ok: true, threads });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        threads: [],
      },
      { status: 200 },
    );
  }
}
