import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// GET /api/messages/unread-count → returns { count } for the current user.
// Customer caller: their own unread threads. Admin caller: admin-side total.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", count: 0 },
      { status: 401 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ ok: false, count: 0 });
    }
    const count = await fetchQuery(
      api.messages.myUnreadCount,
      {},
      { token },
    );
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        count: 0,
      },
      { status: 200 },
    );
  }
}
