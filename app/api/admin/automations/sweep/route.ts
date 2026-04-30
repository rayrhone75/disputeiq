import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { requireRole } from "@/lib/auth";

// POST /api/admin/automations/sweep   body: { dryRun?: boolean }
//
// Walks every customer, runs the rules, upserts events idempotently.
// Returns counters so the admin UI can confirm what fired.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
  const body = (await req.json().catch(() => ({}))) as { dryRun?: unknown };
  const dryRun = body.dryRun === true;
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN" },
        { status: 200 },
      );
    }
    const result = await fetchMutation(
      api.automations.runRuleSweep,
      { dryRun },
      { token },
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "SWEEP_FAILED",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }
}
