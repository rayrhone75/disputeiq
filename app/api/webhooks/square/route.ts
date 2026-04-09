import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySquareSignature } from "@/lib/square";
import { enqueue } from "@/lib/queue";
import { ensureJobHandlers } from "@/lib/jobs/register";
import { writeAuditLog } from "@/lib/audit";

ensureJobHandlers();

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");
  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySquareSignature(raw, sig)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const paymentRef = event?.data?.object?.payment?.reference_id;
  const providerPaymentId = event?.data?.object?.payment?.id;
  if (!paymentRef) return NextResponse.json({ ok: true });

  // Idempotency: if we've already marked this PaymentIntent as SUCCEEDED with
  // this provider id, do nothing. The unique constraint on providerPaymentId
  // is the second line of defense against double-credit.
  const existing = await prisma.paymentIntent.findUnique({ where: { id: paymentRef } });
  if (existing?.status === "SUCCEEDED" && existing.providerPaymentId === providerPaymentId) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const payment = await prisma.paymentIntent.update({
    where: { id: paymentRef },
    data: { providerPaymentId, status: "SUCCEEDED" },
  });

  if (payment.disputeCaseId) {
    await prisma.disputeCase.update({
      where: { id: payment.disputeCaseId },
      data: { status: "PAID" },
    });
    await enqueue({ name: "dispatch-letter", payload: { disputeCaseId: payment.disputeCaseId } });
  }

  // Activate pending subscription if this payment is for a plan checkout.
  // The description field contains the plan name if created by /api/subscriptions/create.
  if (payment.description?.includes("plan")) {
    const sub = await prisma.userSubscription.findUnique({
      where: { userId: payment.userId },
    });
    if (sub && sub.status === "pending") {
      await prisma.userSubscription.update({
        where: { id: sub.id },
        data: { status: "active" },
      });
      await writeAuditLog({
        targetUserId: payment.userId,
        action: "SUBSCRIPTION_ACTIVATED",
        entityType: "UserSubscription",
        entityId: sub.id,
        metadataJson: { planCode: sub.planCode, paymentId: payment.id },
      }).catch(() => null);
    }
  }

  await writeAuditLog({
    targetUserId: payment.userId,
    action: "PAYMENT_SUCCEEDED",
    entityType: "PaymentIntent",
    entityId: payment.id,
    metadataJson: { providerPaymentId },
  });

  return NextResponse.json({ ok: true });
}
