import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { IDIQ_SETTING_KEYS, loadIdiqConfig } from "@/lib/integrations/identityiq";
import type { Prisma } from "@prisma/client";

const UpdateZ = z.object({
  affiliateUrl: z.string().url().max(2048),
  stageUrl: z.string().url().max(2048).optional().nullable(),
  displayName: z.string().min(1).max(120),
  instructions: z.string().max(4000),
  disclaimer: z.string().max(4000),
  featureFlags: z.record(z.boolean()).optional(),
});

export async function GET() {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const config = await loadIdiqConfig();
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const values: Array<[string, unknown]> = [
    [IDIQ_SETTING_KEYS.affiliateUrl, parsed.data.affiliateUrl],
    [IDIQ_SETTING_KEYS.stageUrl, parsed.data.stageUrl ?? null],
    [IDIQ_SETTING_KEYS.displayName, parsed.data.displayName],
    [IDIQ_SETTING_KEYS.instructions, parsed.data.instructions],
    [IDIQ_SETTING_KEYS.disclaimer, parsed.data.disclaimer],
    [IDIQ_SETTING_KEYS.featureFlags, parsed.data.featureFlags ?? {}],
  ];
  await prisma.$transaction(
    values.map(([key, v]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, valueJson: v as Prisma.InputJsonValue, updatedBy: user.id },
        update: { valueJson: v as Prisma.InputJsonValue, updatedBy: user.id },
      }),
    ),
  );
  await writeAuditLog({
    actorUserId: user.id,
    action: "PLATFORM_SETTING_UPDATED",
    entityType: "PlatformSetting",
    entityId: "idiq",
    metadataJson: { keys: values.map(([k]) => k) },
  });
  return NextResponse.json({ ok: true });
}
