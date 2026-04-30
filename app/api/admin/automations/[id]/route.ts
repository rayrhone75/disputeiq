import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireRole } from "@/lib/auth";

// POST /api/admin/automations/:id  body: { status: "reviewed" | "resolved" | "open" }

export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "reviewed", "resolved"]);

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
  const me = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
    return NextResponse.json({ ok: false, code: "BAD_STATUS" }, { status: 400 });
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
      api.automations.setEventStatus,
      {
        eventId: id as unknown as Id<"automationEvents">,
        status: body.status as "open" | "reviewed" | "resolved",
      },
      { token },
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
