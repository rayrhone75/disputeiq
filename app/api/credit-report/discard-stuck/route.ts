import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// POST /api/credit-report/discard-stuck
//
// Marks the calling user's latest non-NORMALIZED creditReportImports row
// as ARCHIVED so the snapshot endpoint stops returning it. Used by the
// "Discard previous import & start over" button in EmptyResultsRecovery
// when a customer is stuck on the recovery card because their previous
// upload landed in FETCHED or PENDING and never normalized.
//
// Best-effort: returns 200 even if no row needed archiving so the client
// can do an unconditional "discard then reload" without branching.

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  try {
    const token = (await getToken({ template: "convex" })) ?? undefined;
    const result = await fetchMutation(
      api.creditImports.discardLatestStuckForCurrentUser,
      {},
      { token },
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message },
      { status: 200 },
    );
  }
}
