import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// MyFreeScoreNow return-to-app callback. We persist click + return metadata
// only — we do not fabricate any API fields. Once MFSN affiliate docs are
// provided we wire the actual report-pull on top of this handler.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  const externalRef = req.nextUrl.searchParams.get("trk") ?? req.nextUrl.searchParams.get("id") ?? null;

  if (ref) {
    await writeAuditLog({
      targetUserId: ref,
      action: "MFSN_RETURN",
      entityType: "User",
      entityId: ref,
      metadataJson: { externalRef, query: Object.fromEntries(req.nextUrl.searchParams) },
    }).catch(() => null);
  }

  // Bounce back into the dashboard. Real report sync runs after the user
  // confirms inside the app, never silently.
  return NextResponse.redirect(new URL("/dashboard/reports?mfsn=returned", req.url));
}

export async function POST(req: NextRequest) {
  // Reserved for the real MFSN webhook once we have the payload spec.
  const body = await req.json().catch(() => ({}));
  await writeAuditLog({
    action: "MFSN_WEBHOOK_RECEIVED",
    entityType: "MFSN",
    entityId: "callback",
    metadataJson: { body },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
