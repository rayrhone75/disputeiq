import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Admin Customer 360 — combined data fetch.
//
// Two existing role-gated Convex queries cover everything we need:
//   - api.admin.customerConsole(userId) → user, profile, subscription,
//     creditImports (hydrated with counts), disputes, payments, consents.
//   - api.auditLogs.forUser(userId) → merged actor+target audit timeline.
//
// We wrap both behind a single Clerk-authed API so the admin client
// page makes one network call and so role enforcement happens on the
// server (Convex queries call requireRole internally; we additionally
// 401 here if there's no Clerk session).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_ID" },
      { status: 400 },
    );
  }

  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN" },
        { status: 200 },
      );
    }
    const targetId = id as unknown as Id<"users">;
    const [console, timeline] = await Promise.all([
      fetchQuery(api.admin.customerConsole, { userId: targetId }, { token }),
      fetchQuery(
        api.auditLogs.forUser,
        { userId: targetId, limit: 60 },
        { token },
      ).catch(() => []),
    ]);
    if (!console) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      console,
      timeline,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }
}
