import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { redactJson } from "@/lib/credit-import/redact";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const imp = await prisma.creditReportImport.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const raw = await prisma.creditReportRaw.findUnique({ where: { importId: id } });
  if (!raw) return NextResponse.json({ error: "NO_RAW" }, { status: 404 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypt(raw.encryptedPayload));
  } catch (err) {
    return NextResponse.json(
      { error: "DECRYPT_FAILED", message: (err as Error).message },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorUserId: user.id,
    targetUserId: imp.userId,
    action: "CREDIT_IMPORT_RAW_INSPECTED",
    entityType: "CreditReportImport",
    entityId: imp.id,
    metadataJson: { payloadHash: raw.payloadHash },
  });

  return NextResponse.json({
    redacted: true,
    raw: redactJson(parsed),
    payloadBytes: raw.payloadBytes,
    payloadHash: raw.payloadHash,
    capturedAt: raw.capturedAt,
  });
}
