import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCompliantAction } from "@/lib/compliance";
import { getLetterPricing } from "@/lib/pricing";
import { createSquareCheckout } from "@/lib/square";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  userId: z.string(),
  disputeCaseId: z.string(),
  disclosuresAccepted: z.boolean(),
  affiliateDisclosureAccepted: z.boolean(),
  userConfirmed: z.boolean(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const body = parsed.data;
  assertCompliantAction(body);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
  const disputeCase = await prisma.disputeCase.findUniqueOrThrow({ where: { id: body.disputeCaseId } });
  if (disputeCase.userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
    metadataJson: { amountCents: pricing.total },
  });

  return NextResponse.json({ paymentId: payment.id, totalCents: pricing.total, checkoutUrl: checkout.checkoutUrl });
}
