import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gateBillingRoute } from "@/lib/admin/api-helpers";

// POST   /api/admin/customers/:id/billing-override
//   Body: { type: "free" | "discounted" | "custom", value?, reason, expiresAt? }
// DELETE /api/admin/customers/:id/billing-override
//   Body: { reason? }
//
// OWNER/ADMIN only — SUPPORT cannot mutate billing.

export const dynamic = "force-dynamic";

const TYPES = new Set(["free", "discounted", "custom"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateBillingRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;

  const body = (await req.json().catch(() => ({}))) as {
    type?: unknown;
    value?: unknown;
    reason?: unknown;
    expiresAt?: unknown;
  };
  if (typeof body.type !== "string" || !TYPES.has(body.type)) {
    return NextResponse.json(
      { ok: false, code: "BAD_TYPE" },
      { status: 400 },
    );
  }
  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json(
      { ok: false, code: "REASON_REQUIRED" },
      { status: 400 },
    );
  }
  const args: {
    customerId: typeof customerId;
    type: "free" | "discounted" | "custom";
    value?: number;
    reason: string;
    expiresAt?: number;
  } = {
    customerId,
    type: body.type as "free" | "discounted" | "custom",
    reason: body.reason,
  };
  if (typeof body.value === "number") args.value = body.value;
  if (typeof body.expiresAt === "number") args.expiresAt = body.expiresAt;
  try {
    const r = await fetchMutation(
      api.billing.setBillingOverride,
      args,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateBillingRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  try {
    const r = await fetchMutation(
      api.billing.clearBillingOverride,
      {
        customerId,
        reason:
          typeof body.reason === "string" ? body.reason : undefined,
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
