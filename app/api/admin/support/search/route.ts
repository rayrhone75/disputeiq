import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";

// Fast customer lookup for the support workspace.
// Matches on email substring, exact user id, or import id substring.
export async function GET(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const includeArchived = url.searchParams.get("archived") === "1";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "25"), 1),
    100,
  );

  const users = await fetchQuery(
    api.support.searchUsers,
    { q, includeArchived, limit },
    { token },
  );
  return NextResponse.json({ users });
}
