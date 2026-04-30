import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { requireRole } from "@/lib/auth";

// GET /api/admin/automations
//   ?status=open|reviewed|resolved (default: open)
//   &severity=info|warn|alert (optional)
//   &limit=N (default 100, max 500)

export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "reviewed", "resolved"]);
const SEVERITIES = new Set(["info", "warn", "alert"]);

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", events: [], counts: null },
      { status: 401 },
    );
  }
  const me = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", events: [], counts: null },
      { status: 403 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ ok: false, events: [], counts: null });
    }
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status") ?? "open";
    const severityParam = url.searchParams.get("severity");
    const limitParam = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const status = STATUSES.has(statusParam)
      ? (statusParam as "open" | "reviewed" | "resolved")
      : "open";
    const severity =
      severityParam && SEVERITIES.has(severityParam)
        ? (severityParam as "info" | "warn" | "alert")
        : undefined;

    const [events, counts] = await Promise.all([
      fetchQuery(
        api.automations.listEvents,
        { status, severity, limit: Number.isFinite(limitParam) ? limitParam : 100 },
        { token },
      ),
      fetchQuery(api.automations.eventCounts, {}, { token }).catch(
        () => null,
      ),
    ]);
    return NextResponse.json({ ok: true, events, counts });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        events: [],
        counts: null,
      },
      { status: 200 },
    );
  }
}
