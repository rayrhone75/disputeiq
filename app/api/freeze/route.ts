import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { listFreezesForUser, queueFreezesForUser, setFreezeStatus } from "@/lib/freeze";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rows = await listFreezesForUser(user.id);
  return NextResponse.json({ freezes: rows });
}

const queueSchema = z.object({ consent: z.literal(true) });

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const parsed = queueSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
  const created = await queueFreezesForUser(user.id, "user_dashboard");
  return NextResponse.json({ created: created.length });
}

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  confirmationRef: z.string().optional(),
  lastError: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const updated = await setFreezeStatus({ ...parsed.data, userId: user.id });
  return NextResponse.json({ ok: true, freeze: updated });
}
