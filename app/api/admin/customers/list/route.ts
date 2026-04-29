import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Admin customers list — wraps the existing role-gated
// `creditImports.adminListUsers` query. Used by the /admin/customers
// index page so the page itself doesn't fetch Convex during SSR.

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
    if (!token) {
      return NextResponse.json({ ok: false, code: "NO_CONVEX_TOKEN", rows: [] });
    }
    const rows = await fetchQuery(
      api.creditImports.adminListUsers,
      { limit: 500 },
      { token },
    );
    return NextResponse.json({ ok: true, rows });
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
