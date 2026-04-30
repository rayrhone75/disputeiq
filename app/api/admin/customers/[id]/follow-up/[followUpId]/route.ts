import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { gateAdminRoute } from "@/lib/admin/api-helpers";

// PATCH /api/admin/customers/:id/follow-up/:followUpId — update status.
// Body: { status: "pending" | "done" | "dismissed" }

export const dynamic = "force-dynamic";

const STATUSES = new Set(["pending", "done", "dismissed"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; followUpId: string }> },
) {
  const { id, followUpId } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken } = gate.ctx;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
    return NextResponse.json(
      { ok: false, code: "BAD_STATUS" },
      { status: 400 },
    );
  }
  try {
    const r = await fetchMutation(
      api.adminCustomers.updateFollowUp,
      {
        followUpId: followUpId as unknown as Id<"customerFollowUps">,
        status: body.status as "pending" | "done" | "dismissed",
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
