import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { assertCompliantAction } from "@/lib/compliance";
import { getUserPacketUsage } from "@/lib/billing/usage";
import { createStripeCheckoutSession } from "@/lib/stripe-checkout";
import { createSquareCheckout } from "@/lib/square";
import { selectPaymentProvider } from "@/lib/payments/provider";
import { writeAuditLog } from "@/lib/audit";
import { CHECKOUT_CONSENT_ITEMS, TERMS_VERSION } from "@/lib/legal";

const schema = z.object({
  userId: z.string().optional(),
  disputeCaseId: z.string(),
  disclosuresAccepted: z.boolean(),
  affiliateDisclosureAccepted: z.boolean(),
  userConfirmed: z.boolean(),
  // Pre-payment consent flags — every one must be true.
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
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  assertCompliantAction(body);

  // Enforce checkout consent (all 4 flags required when provided).
  if (body.checkoutConsents) {
    const allTrue = CHECKOUT_CONSENT_ITEMS.every(
      (it) => body.checkoutConsents?.[it.key] === true,
    );
    if (!allTrue) {
      return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
    }
  }

  // Verify the dispute case is owned by the caller.
  const dcRow = await fetchQuery(
    api.payments.disputeCaseForCheckout,
    { id: body.disputeCaseId as Id<"disputeCases"> },
    { token },
  );
  if (!dcRow) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // Plan-aware pricing: included packets are free, overage costs $19.95.
  const usage = await getUserPacketUsage();
  const overview = await fetchQuery(api.onboarding.dashboardOverview, {}, { token });
  const isGrace = overview?.user.isGraceUser ?? false;

  let totalCents: number;
  if (isGrace) {
    totalCents = 0;
  } else if (usage.plan && usage.remaining > 0) {
    totalCents = 0;
  } else {
    totalCents = usage.overagePriceCents;
  }

  const description = `Letter action for dispute case ${body.disputeCaseId}`;

  // Provider choice: Square primary, Stripe fallback (lib/payments/provider).
  // A $0 charge (grace user / included packet) needs no provider at all.
  const provider = selectPaymentProvider();
  if (totalCents > 0 && !provider) {
    return NextResponse.json({ error: "PAYMENTS_UNAVAILABLE" }, { status: 503 });
  }

  const paymentIntentId = (await fetchMutation(
    api.payments.createForDispute,
    {
      disputeCaseId: body.disputeCaseId as Id<"disputeCases">,
      provider: totalCents === 0 ? "NONE" : (provider as string),
      amountCents: totalCents,
      description,
    },
    { token },
  )) as Id<"paymentIntents">;

  // Persist a ConsentReceipt before issuing the checkout.
  if (body.checkoutConsents) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const ua = req.headers.get("user-agent") ?? undefined;
    await fetchMutation(
      api.payments.recordCheckoutConsent,
      {
        disputeCaseId: body.disputeCaseId as Id<"disputeCases">,
        paymentIntentId,
        termsVersion: TERMS_VERSION,
        consents: body.checkoutConsents,
        amountCents: totalCents,
        ipAddress: ip,
        userAgent: ua,
      },
      { token },
    ).catch(() => null);
  }

  // $0 (grace user / included packet): settle immediately, no provider hop.
  if (totalCents === 0) {
    await fetchMutation(
      api.payments.settleZeroAmount,
      { paymentIntentId },
      { token },
    ).catch(() => null);
    await writeAuditLog({
      action: "CHECKOUT_CREATED",
      entityType: "PaymentIntent",
      entityId: paymentIntentId as unknown as string,
      metadataJson: { amountCents: 0, provider: "NONE" },
    }).catch(() => null);
    return NextResponse.json({
      paymentId: paymentIntentId,
      totalCents: 0,
      checkoutUrl: `/dashboard/disputes?paid=1&intent=${encodeURIComponent(paymentIntentId as unknown as string)}`,
    });
  }

  let checkoutUrl: string;
  try {
    if (provider === "SQUARE") {
      const r = await createSquareCheckout({
        amountCents: totalCents,
        referenceId: paymentIntentId as unknown as string,
        description,
      });
      checkoutUrl = r.checkoutUrl;
    } else {
      // Stripe fallback. Attach the user's existing Stripe customer (set when
      // they subscribed) so the charge lands on the same customer record.
      const sub = await fetchQuery(api.subscriptions.getForUser, {}, { token });
      const stripeCustomerId = sub?.stripeCustomerId ?? undefined;
      const r = await createStripeCheckoutSession({
        amountCents: totalCents,
        referenceId: paymentIntentId as unknown as string,
        description,
        customerId: stripeCustomerId,
      });
      checkoutUrl = r.checkoutUrl;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "CHECKOUT_FAILED", provider, message: (err as Error).message },
      { status: 502 },
    );
  }

  await writeAuditLog({
    action: "CHECKOUT_CREATED",
    entityType: "PaymentIntent",
    entityId: paymentIntentId as unknown as string,
    metadataJson: { amountCents: totalCents, provider },
  }).catch(() => null);

  return NextResponse.json({
    paymentId: paymentIntentId,
    totalCents,
    checkoutUrl,
  });
}
