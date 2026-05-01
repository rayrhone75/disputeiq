import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// GET /api/extension/pairings — fail-soft wrapper around
// `api.extensionPairings.listMine`.
//
// Why this exists: the dashboard's <ExtensionPairingCard> previously
// used `useQuery(api.extensionPairings.listMine)` directly. If that
// Convex query throws (user not yet mirrored, schema validation blip,
// transient unavailability), React 19 surfaces the exception during
// render and crashes the whole /dashboard/get-report route. Wrapping
// the call here lets the card use a normal fetch + state pattern and
// degrade to a "Connector status unavailable — retry" panel instead
// of crashing the page.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", pairings: [] },
      { status: 401 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({
        ok: false,
        code: "NO_CONVEX_TOKEN",
        pairings: [],
      });
    }
    const pairings = await fetchQuery(
      api.extensionPairings.listMine,
      {},
      { token },
    );
    return NextResponse.json({ ok: true, pairings });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        pairings: [],
      },
      { status: 200 },
    );
  }
}
