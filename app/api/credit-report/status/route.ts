import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadCreditReportStatus } from "@/lib/credit-import/status";

// Client-side status fetcher — moves Convex calls off the page render path.
// Returns the same `CreditReportStatusSummary` shape the dashboard previously
// computed in its server component, but failures here only affect the
// status pill, not the whole page.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    const status = await loadCreditReportStatus(token);
    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        lastUpdatedAt: status.lastUpdatedAt
          ? status.lastUpdatedAt.toISOString()
          : null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "STATUS_LOAD_FAILED",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }
}
