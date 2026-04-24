import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  expectedPurgeConfirmation,
  isConfirmationOk,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

const BodyZ = z.object({
  reason: z.string().min(10).max(2000),
  confirmation: z.string().min(1).max(200),
});

// OWNER-only. Requires typed confirmation of the literal phrase
// "PURGE <email>" — any mismatch returns 400 without touching data.
export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN_OWNER_ONLY" }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = BodyZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const preview = await fetchQuery(
    api.admin.previewUserImpact,
    { userId: id as Id<"users"> },
    { token },
  ).catch(() => null);
  if (!preview) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (
    !isConfirmationOk(
      parsed.data.confirmation,
      expectedPurgeConfirmation(preview.user.email),
    )
  ) {
    return NextResponse.json(
      {
        error: "CONFIRMATION_MISMATCH",
        message: `Confirmation phrase must be exactly: ${expectedPurgeConfirmation(preview.user.email)}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchMutation(
      api.admin.hardPurgeUser,
      { userId: id as Id<"users">, reason: parsed.data.reason },
      { token },
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "FORBIDDEN", message: msg }, { status: 403 });
    }
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND", message: msg }, { status: 404 });
    }
    if (msg.includes("SELF_PURGE_FORBIDDEN")) {
      return NextResponse.json(
        { error: "SELF_PURGE_FORBIDDEN", message: msg },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}
