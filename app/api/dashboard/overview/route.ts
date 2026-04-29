import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Customer-facing dashboard overview API.
//
// Wraps the existing `api.onboarding.dashboardOverview` Convex query so
// the customer portal home can fetch its data client-side instead of
// during SSR. This is the same pattern that fixed the get-report SSR
// 500 — the page render is no longer coupled to Convex availability.
//
// Returns a `DashboardOverview` payload with reports, tradelines,
// disputes, mail jobs, subscription, packet usage, credit-report
// status, and onboarding step. Failures return `{ ok: false, overview: null }`
// instead of throwing, so the client can render a graceful empty state.
//
// No new Convex functions, no schema changes — uses only the deployed
// `dashboardOverview` query.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", overview: null },
      { status: 401 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN", overview: null },
        { status: 200 },
      );
    }
    const overview = await fetchQuery(
      api.onboarding.dashboardOverview,
      {},
      { token },
    );
    return NextResponse.json({ ok: true, overview });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "OVERVIEW_LOAD_FAILED",
        message: (err as Error).message,
        overview: null,
      },
      { status: 200 },
    );
  }
}
