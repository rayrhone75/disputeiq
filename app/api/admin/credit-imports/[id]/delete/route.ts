import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DeletionError,
  expectedImportConfirmation,
  isConfirmationOk,
} from "@/lib/admin/deletion";

type Params = { params: Promise<{ id: string }> };

const DeleteZ = z.object({
  reason: z.string().min(10).max(2000),
  confirmation: z.string().min(1).max(200),
});

// Preview the delete impact without changing anything. The UI calls this
// first to build the confirmation screen.
export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const impact = await fetchQuery(
      api.admin.previewImportImpact,
      { importId: id as Id<"creditReportImports"> },
      { token },
    );
    return NextResponse.json({
      ...impact,
      expectedConfirmation: expectedImportConfirmation(id),
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND", message: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = DeleteZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isConfirmationOk(parsed.data.confirmation, expectedImportConfirmation(id))) {
    return NextResponse.json(
      {
        error: "CONFIRMATION_MISMATCH",
        message: `Confirmation phrase must be exactly: ${expectedImportConfirmation(id)}`,
      },
      { status: 400 },
    );
  }

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const result = await fetchMutation(
      api.admin.deleteImport,
      {
        importId: id as Id<"creditReportImports">,
        reason: parsed.data.reason,
      },
      { token },
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (err instanceof DeletionError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    if (msg.includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND", message: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "INTERNAL", message: msg }, { status: 500 });
  }
}
