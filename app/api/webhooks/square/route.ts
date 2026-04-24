import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { verifySquareSignature } from "@/lib/square";
import { enqueue } from "@/lib/queue";
import { ensureJobHandlers } from "@/lib/jobs/register";
import { PLANS } from "@/lib/billing/plans";

ensureJobHandlers();

// Public route — no Clerk session. We verify Square's HMAC, then forward
// the parsed event into Convex via system-secret-guarded mutations.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");
  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySquareSignature(raw, sig)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }
  const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  if (!secret) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 });
  }

  const event = JSON.parse(raw);
  const eventType: string = event?.type ?? "";

  // ─── Subscription events ────────────────────────────────────────────────
  if (eventType === "subscription.created" || eventType === "subscription.updated") {
    const sub = event?.data?.object?.subscription;
    if (sub?.customer_id) {
      await fetchMutation(api.subscriptions.recordSquareEvent, {
        secret,
        kind: "subscription_event",
        eventType,
        squareSubscriptionId: sub.id,
        squareCustomerId: sub.customer_id,
        squareStatus: sub.status,
        chargedThroughDate: sub.charged_through_date,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Invoice payment failed ─────────────────────────────────────────────
  if (eventType === "invoice.payment_failed") {
    const invoice = event?.data?.object?.invoice;
    const customerId =
      invoice?.primary_recipient?.customer_id ?? invoice?.customer_id;
    if (customerId) {
      await fetchMutation(api.subscriptions.recordSquareEvent, {
        secret,
        kind: "invoice_payment_failed",
        eventType,
        squareCustomerId: customerId,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Invoice payment made (subscription renewal) ────────────────────────
  if (eventType === "invoice.payment_made") {
    const invoice = event?.data?.object?.invoice;
    const customerId =
      invoice?.primary_recipient?.customer_id ?? invoice?.customer_id;
    if (customerId) {
      // Best-effort: pass the user's plan included-packets if knowable. The
      // mutation will fall through to the existing subscription's plan if
      // we don't.
      await fetchMutation(api.subscriptions.recordSquareEvent, {
        secret,
        kind: "invoice_payment_made",
        eventType,
        squareCustomerId: customerId,
        includedPacketsHint: undefined,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Payment events (one-time packet charges) ───────────────────────────
  const paymentRef: string | undefined =
    event?.data?.object?.payment?.reference_id;
  const providerPaymentId: string | undefined =
    event?.data?.object?.payment?.id;
  if (!paymentRef || !providerPaymentId) {
    return NextResponse.json({ ok: true });
  }

  type PaymentResult = {
    matched: boolean;
    idempotent?: boolean;
    disputeCaseId?: Id<"disputeCases"> | null;
  };
  let result: PaymentResult | null = null;
  try {
    result = (await fetchMutation(api.payments.recordSquarePayment, {
      secret,
      paymentIntentId: paymentRef as Id<"paymentIntents">,
      providerPaymentId,
    })) as PaymentResult;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!result || !result.matched) return NextResponse.json({ ok: true });
  if (result.idempotent) return NextResponse.json({ ok: true, idempotent: true });

  if (result.disputeCaseId) {
    await enqueue({
      name: "dispatch-letter",
      payload: { disputeCaseId: result.disputeCaseId as unknown as string },
    });
  }
  // Quiet the unused-import lint: PLANS is referenced by dependent jobs.
  void PLANS;

  return NextResponse.json({ ok: true });
}
