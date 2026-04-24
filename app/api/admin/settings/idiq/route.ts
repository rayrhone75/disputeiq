import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { IDIQ_SETTING_KEYS, loadIdiqConfig } from "@/lib/integrations/identityiq";
// TODO: agent1 — `convex/platformSettings.ts` is owned by Agent 1. Once
// it exists, swap this import to `import { api } from "@/convex/_generated/api"`
// and call `fetchMutation(api.platformSettings.upsert, ...)`.
import { api } from "@/convex/_generated/api";

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

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const values: Array<[string, unknown]> = [
    [IDIQ_SETTING_KEYS.affiliateUrl, parsed.data.affiliateUrl],
    [IDIQ_SETTING_KEYS.stageUrl, parsed.data.stageUrl ?? null],
    [IDIQ_SETTING_KEYS.displayName, parsed.data.displayName],
    [IDIQ_SETTING_KEYS.instructions, parsed.data.instructions],
    [IDIQ_SETTING_KEYS.disclaimer, parsed.data.disclaimer],
    [IDIQ_SETTING_KEYS.featureFlags, parsed.data.featureFlags ?? {}],
  ];

  // TODO: agent1 — once `convex/platformSettings.ts` exists, replace this
  // with a single batched `fetchMutation(api.platformSettings.upsertMany, ...)`.
  // For now we attempt to call a per-key mutation; if Agent 1 hasn't shipped
  // the function yet the calls below will throw and we'll surface that to
  // the operator.
  try {
    for (const [key, valueJson] of values) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformSettingsApi = (api as any).platformSettings;
      if (!platformSettingsApi?.upsert) {
        throw new Error("platformSettings.upsert not implemented yet (Agent 1)");
      }
      await fetchMutation(
        platformSettingsApi.upsert,
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
      { status: 501 },
    );
  }

  await writeAuditLog({
    action: "PLATFORM_SETTING_UPDATED",
    entityType: "PlatformSetting",
    entityId: "idiq",
    metadataJson: { keys: values.map(([k]) => k) },
  });

  return NextResponse.json({ ok: true });
}
