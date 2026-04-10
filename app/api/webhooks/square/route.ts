import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySquareSignature } from "@/lib/square";
import { enqueue } from "@/lib/queue";
import { ensureJobHandlers } from "@/lib/jobs/register";
import { writeAuditLog } from "@/lib/audit";
import { PLANS } from "@/lib/billing/plans";

ensureJobHandlers();

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");
  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySquareSignature(raw, sig)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const eventType = event?.type ?? "";

  // ─── Subscription events ────────────────────────────────────────────────
  if (eventType === "subscription.created" || eventType === "subscription.updated") {
    const sub = event?.data?.object?.subscription;
    if (sub?.customer_id) {
      await handleSubscriptionEvent(sub, eventType);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Invoice payment failed ─────────────────────────────────────────────
  if (eventType === "invoice.payment_failed") {
    const invoice = event?.data?.object?.invoice;
    const customerId = invoice?.primary_recipient?.customer_id ?? invoice?.customer_id;
    if (customerId) {
      await markSubscriptionPastDue(customerId, eventType);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Invoice payment made (subscription renewal) ────────────────────────
  if (eventType === "invoice.payment_made") {
    const invoice = event?.data?.object?.invoice;
    const customerId = invoice?.primary_recipient?.customer_id ?? invoice?.customer_id;
    if (customerId) {
      await confirmSubscriptionRenewal(customerId, eventType);
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Payment events (one-time packet charges) ──────────────────────────
  const paymentRef = event?.data?.object?.payment?.reference_id;
  const providerPaymentId = event?.data?.object?.payment?.id;
  if (!paymentRef) return NextResponse.json({ ok: true });

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

  await writeAuditLog({
    targetUserId: payment.userId,
    action: "PAYMENT_SUCCEEDED",
    entityType: "PaymentIntent",
    entityId: payment.id,
    metadataJson: { providerPaymentId },
  });

  return NextResponse.json({ ok: true });
}

// ─── Subscription event handlers ────────────────────────────────────────────

async function handleSubscriptionEvent(sub: any, eventType: string) {
  const squareSubId = sub.id;
  const customerId = sub.customer_id;
  const squareStatus = sub.status; // ACTIVE, CANCELED, PAUSED, DELINQUENT
  const chargedThrough = sub.charged_through_date;

  // Find our subscription by Square subscription ID or customer reference
  let localSub = await prisma.userSubscription.findFirst({
    where: { squareSubscriptionId: squareSubId },
  });

  if (!localSub) {
    // Try finding by Square customer reference
    const customer = await findUserBySquareCustomer(customerId);
    if (customer) {
      localSub = await prisma.userSubscription.findUnique({
        where: { userId: customer.id },
      });
    }
  }

  if (!localSub) return;

  const mappedStatus = mapSquareStatus(squareStatus);

  await prisma.userSubscription.update({
    where: { id: localSub.id },
    data: {
      status: mappedStatus,
      squareSubscriptionId: squareSubId,
      cycleEnd: chargedThrough ? new Date(chargedThrough) : localSub.cycleEnd,
    },
  });

  await writeAuditLog({
    targetUserId: localSub.userId,
    action: `SUBSCRIPTION_${eventType.toUpperCase().replace(".", "_")}`,
    entityType: "UserSubscription",
    entityId: localSub.id,
    metadataJson: { squareStatus, mappedStatus, squareSubId, chargedThrough },
  }).catch(() => null);
}

async function markSubscriptionPastDue(customerId: string, eventType: string) {
  const user = await findUserBySquareCustomer(customerId);
  if (!user) return;

  const sub = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return;

  await prisma.userSubscription.update({
    where: { id: sub.id },
    data: { status: "past_due" },
  });

  await writeAuditLog({
    targetUserId: user.id,
    action: "SUBSCRIPTION_PAYMENT_FAILED",
    entityType: "UserSubscription",
    entityId: sub.id,
    metadataJson: { squareCustomerId: customerId },
  }).catch(() => null);
}

async function confirmSubscriptionRenewal(customerId: string, eventType: string) {
  const user = await findUserBySquareCustomer(customerId);
  if (!user) return;

  const sub = await prisma.userSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return;

  // Reset cycle and re-activate
  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  const plan = PLANS[sub.planCode as keyof typeof PLANS];

  await prisma.userSubscription.update({
    where: { id: sub.id },
    data: {
      status: "active",
      cycleStart: now,
      cycleEnd,
      includedPackets: plan?.includedPackets ?? sub.includedPackets,
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    action: "SUBSCRIPTION_RENEWED",
    entityType: "UserSubscription",
    entityId: sub.id,
    metadataJson: { squareCustomerId: customerId },
  }).catch(() => null);
}

async function findUserBySquareCustomer(customerId: string) {
  // Look up by stored subscription squareSubscriptionId won't work for customer-level events.
  // Instead search audit logs for the customer ID, or check PaymentIntent references.
  // Simplest: search UserSubscription for any row, or search audit for SUBSCRIPTION_CREATED.
  const log = await prisma.auditLog.findFirst({
    where: {
      action: "SUBSCRIPTION_CREATED",
      metadataJson: { path: ["squareCustomerId"], equals: customerId },
    },
  });
  if (log?.targetUserId) {
    return prisma.user.findUnique({ where: { id: log.targetUserId } });
  }
  return null;
}

function mapSquareStatus(squareStatus: string): string {
  switch (squareStatus?.toUpperCase()) {
    case "ACTIVE": return "active";
    case "CANCELED": return "canceled";
    case "DELINQUENT": return "past_due";
    case "PAUSED": return "past_due";
    case "PENDING": return "pending";
    default: return "active";
  }
}
