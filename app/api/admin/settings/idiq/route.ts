// Admin endpoint to update the supported report provider (MyScoreIQ).
// Route URL is `/api/admin/settings/idiq` for backwards compatibility with
// the existing admin form; values are written under `msiq.*` platformSettings
// keys going forward. Legacy `idiq.*` rows remain readable as a fallback in
// `loadMsiqConfig`.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { MSIQ_SETTING_KEYS, loadMsiqConfig } from "@/lib/integrations/myscoreiq";
import { api } from "@/convex/_generated/api";

const UpdateZ = z.object({
  affiliateUrl: z.string().url().max(2048),
  jsonReportUrl: z.string().url().max(2048),
  stageUrl: z.string().url().max(2048).optional().nullable(),
  displayName: z.string().min(1).max(120),
  instructions: z.string().max(4000),
  disclaimer: z.string().max(4000),
  featureFlags: z.record(z.boolean()).optional(),
});

export async function GET() {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const config = await loadMsiqConfig();
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

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const values: Array<[string, unknown]> = [
    [MSIQ_SETTING_KEYS.affiliateUrl, parsed.data.affiliateUrl],
    [MSIQ_SETTING_KEYS.jsonReportUrl, parsed.data.jsonReportUrl],
    [MSIQ_SETTING_KEYS.stageUrl, parsed.data.stageUrl ?? null],
    [MSIQ_SETTING_KEYS.displayName, parsed.data.displayName],
    [MSIQ_SETTING_KEYS.instructions, parsed.data.instructions],
    [MSIQ_SETTING_KEYS.disclaimer, parsed.data.disclaimer],
    [MSIQ_SETTING_KEYS.featureFlags, parsed.data.featureFlags ?? {}],
  ];

  try {
    for (const [key, valueJson] of values) {
      await fetchMutation(
        api.platformSettings.upsert,
        { key, valueJson },
        { token },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "PLATFORM_SETTINGS_UNAVAILABLE",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }

  await writeAuditLog({
    action: "PLATFORM_SETTING_UPDATED",
    entityType: "PlatformSetting",
    entityId: "msiq",
    metadataJson: { keys: values.map(([k]) => k) },
  });

  return NextResponse.json({ ok: true });
}
