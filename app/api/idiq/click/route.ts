import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: true }); // anonymous is fine
  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "IDIQ_CLICK",
    entityType: "User",
    entityId: user.id,
    metadataJson: { at: new Date().toISOString() },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
