import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queueShadowStrike } from "@/lib/shadow-strike";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  userId: z.string(),
  provider: z.enum(["LEXISNEXIS", "INNOVIS", "SAGESTREAM"]),
  userConfirmed: z.literal(true),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const r = await queueShadowStrike(parsed.data);
  await writeAuditLog({
    targetUserId: parsed.data.userId,
    action: "SHADOW_STRIKE_QUEUED",
    entityType: "ShadowStrikeRequest",
    entityId: r.id,
    metadataJson: { provider: parsed.data.provider },
  });
  return NextResponse.json({ id: r.id });
}
