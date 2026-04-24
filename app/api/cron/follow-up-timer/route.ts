import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Daily sweep: any DELIVERED or RESPONSE_RECEIVED dispute whose responseDueAt
// has elapsed is flipped to ESCALATION_READY. The actual scan + state
// transitions live inside `api.mailJobs.scanForFollowUps`, gated by
// `CRON_SECRET`.
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. If
// CRON_SECRET is unset (local dev) we skip the bearer check but still
// forward an empty secret — the Convex mutation will accept it because the
// matching env var inside Convex will also be unset.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  try {
    const result = await fetchMutation(api.mailJobs.scanForFollowUps, { secret });
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      transitioned: result.transitioned,
      at: new Date(result.atMs).toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json({ error: "INTERNAL", detail: msg }, { status: 500 });
  }
}
