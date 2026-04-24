import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  expectedPurgeConfirmation,
  expectedUserConfirmation,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const impact = await fetchQuery(
      api.admin.previewUserImpact,
      { userId: id as Id<"users"> },
      { token },
    );
    return NextResponse.json({
      ...impact,
      expectedConfirmation: {
        archive: expectedUserConfirmation(impact.user.email),
        purge: expectedPurgeConfirmation(impact.user.email),
      },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND", message: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}
