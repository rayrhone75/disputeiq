import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { requireRole } from "@/lib/auth";
import { topSignal, type HealthInput } from "@/lib/admin/health";

// GET /api/admin/health-feed — returns the top "needs attention" rows
// for the admin home. Combines the Convex inputs query with the
// shared deriveHealthSignals/topSignal helpers.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", rows: [] },
      { status: 401 },
    );
  }
  const me = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", rows: [] },
      { status: 403 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ ok: false, rows: [] });
    }
    const inputs = (await fetchQuery(
      api.admin.customersNeedingAttentionInputs,
      { limit: 200 },
      { token },
    )) as Array<Omit<HealthInput, "nowMs">>;

    const now = Date.now();
    const rows = inputs
      .map((i) => {
        const s = topSignal({ ...i, nowMs: now });
        if (!s) return null;
        return {
          userId: i.user._id ?? null,
          email: i.user.email ?? "",
          isVip: !!i.user.isVip,
          signal: s,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Order: alert > warn > info, then most-recent customer first
    // (inputs already came in createdAt-desc, so we just stable-sort by
    // severity).
    const SEV: Record<string, number> = { alert: 3, warn: 2, info: 1 };
    rows.sort((a, b) => SEV[b.signal.severity] - SEV[a.signal.severity]);

    return NextResponse.json({ ok: true, rows: rows.slice(0, 12) });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        rows: [],
      },
      { status: 200 },
    );
  }
}
