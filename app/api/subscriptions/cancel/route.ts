import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { cancelSquareSubscription } from "@/lib/square-subscriptions";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const sub = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 404 });

  if (sub.squareSubscriptionId) {
    await cancelSquareSubscription(sub.squareSubscriptionId);
  }

  await prisma.userSubscription.update({
    where: { id: sub.id },
    data: { status: "canceled" },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "SUBSCRIPTION_CANCELED",
    entityType: "UserSubscription",
    entityId: sub.id,
    metadataJson: { planCode: sub.planCode },
  });

  return NextResponse.json({ ok: true });
}
