import { NextResponse } from "next/server";

// Legacy MyFreeScoreNow callback. The MFSN integration has been retired in
// favor of IdentityIQ. We keep the route mounted so any stale links return
// a clean 410 Gone rather than 404'ing through to the dashboard. New
// customers should be funneled through `/dashboard` and the IDIQ flow.
export async function GET() {
  return NextResponse.json(
    {
      error: "GONE",
      message:
        "The MyFreeScoreNow integration has been retired. Please use IdentityIQ to import your credit report.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "GONE",
      message: "The MyFreeScoreNow webhook is no longer accepted.",
    },
    { status: 410 },
  );
}
