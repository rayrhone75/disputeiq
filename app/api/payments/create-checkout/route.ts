import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCompliantAction } from "@/lib/compliance";
import { getLetterPricing } from "@/lib/pricing";
import { createSquareCheckout } from "@/lib/square";
import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { CHECKOUT_CONSENT_ITEMS, TERMS_VERSION } from "@/lib/legal";

const schema = z.object({
  userId: z.string().optional(),
  disputeCaseId: z.string(),
  disclosuresAccepted: z.boolean(),
  affiliateDisclosureAccepted: z.boolean(),
  userConfirmed: z.boolean(),
  // Pre-payment consent flags — every one must be true, otherwise we refuse to
  // create a Square checkout. This is the chargeback-defense layer.
  checkoutConsents: z
    .object({
      no_guarantee: z.boolean(),
      authorization: z.boolean(),
      non_refundable: z.boolean(),
      bureau_dependent: z.boolean(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const sessionUser = await requireUser().catch(() => null);
  if (!sessionUser) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const body = parsed.data;
  assertCompliantAction(body);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const disputeCase = await prisma.disputeCase.findUniqueOrThrow({ where: { id: body.disputeCaseId } });
  if (disputeCase.userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Enforce checkout consent (all 4 flags required when provided).
  // Kept optional for backwards-compatibility with existing callers that
  // still use the old disclosures-only shape, but if `checkoutConsents` is
  // present every field must be true.
  if (body.checkoutConsents) {
    const allTrue = CHECKOUT_CONSENT_ITEMS.every(
      (it) => body.checkoutConsents?.[it.key] === true,
    );
    if (!allTrue) {
      return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
    }
  }

  const pricing = getLetterPricing({ isGraceUser: user.isGraceUser });

  const payment = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      disputeCaseId: disputeCase.id,
      provider: "SQUARE",
      amountCents: pricing.total,
      description: `Letter action for dispute case ${disputeCase.id}`,
    },
  });

  // Persist a ConsentReceipt before issuing the Square checkout. This is the
  // legally-defensible record that the user saw and accepted every consent
  // item at the exact version of the terms. IP + user-agent captured for the
  // chargeback trail.
  if (body.checkoutConsents) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    await prisma.consentReceipt.create({
      data: {
        userId: user.id,
        consentType: "DISPUTE_CHECKOUT",
        version: TERMS_VERSION,
        ipAddress: ip,
        userAgent: ua,
      },
    });
    await writeAuditLog({
      targetUserId: user.id,
      actorUserId: user.id,
      action: "CHECKOUT_CONSENT_ACCEPTED",
      entityType: "DisputeCase",
      entityId: disputeCase.id,
      metadataJson: {
        termsVersion: TERMS_VERSION,
        consents: body.checkoutConsents,
        packetDisputeCaseId: disputeCase.id,
        amountCents: pricing.total,
        ip,
      },
    }).catch(() => null);
  }

  const checkout = await createSquareCheckout({
    amountCents: pricing.total,
    referenceId: payment.id,
    description: payment.description,
  });

  await writeAuditLog({
    targetUserId: user.id,
    action: "CHECKOUT_CREATED",
    entityType: "PaymentIntent",
    entityId: payment.id,
    metadataJson: { amountCents: pricing.total, provider: "SQUARE" },
  });

  return NextResponse.json({ paymentId: payment.id, totalCents: pricing.total, checkoutUrl: checkout.checkoutUrl });
}
