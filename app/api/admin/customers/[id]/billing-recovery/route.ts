import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateBillingRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/billing-recovery
//
// Captures a payment-recovery attempt in the audit log. Actual retry
// happens out-of-band in the Stripe Dashboard — Customer 360 deep links
// to it. This endpoint exists so we can show "support attempted
// recovery 2h ago" in the timeline.
//
// OWNER/ADMIN only.

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateBillingRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;
  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  try {
    const r = await fetchMutation(
      api.billing.logPaymentRecoveryAttempt,
      {
        customerId,
        note: typeof body.note === "string" ? body.note : undefined,
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
