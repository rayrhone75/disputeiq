// Square webhook — PRIMARY one-time payment provider.
//
// Square posts payment lifecycle events here. We verify the HMAC signature
// against the raw body, then on a COMPLETED payment map it back to our
// paymentIntents row via the `note` we stamped into the payment link
// (lib/square.ts → createSquareCheckout), and mark the charge SUCCEEDED.
//
// Reconciliation note: this maps `payment.note` → our paymentIntents._id.
// Verify the exact webhook payload shape + signature against a Square
// SANDBOX account before going live (SQUARE_ENVIRONMENT=sandbox).

import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { verifySquareSignature, squareNotificationUrl } from "@/lib/square";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");

  if (!verifySquareSignature(squareNotificationUrl(), raw, signature)) {
    return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const type: string = event?.type ?? "";
  const payment = event?.data?.object?.payment;

  // We only act on a settled payment; everything else is acknowledged so
  // Square stops retrying.
  if (
    (type === "payment.created" || type === "payment.updated") &&
    payment?.status === "COMPLETED"
  ) {
    const paymentIntentId: string | undefined = payment?.note;
    const providerPaymentId: string | undefined = payment?.id;
    if (paymentIntentId && providerPaymentId) {
      try {
        await fetchMutation(api.payments.recordSquarePayment, {
          secret: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "",
          paymentIntentId: paymentIntentId as Id<"paymentIntents">,
          providerPaymentId,
        });
      } catch (err) {
        // Unmatched/malformed note (e.g. a test event) — ack so Square
        // doesn't retry forever; log for diagnostics.
        // eslint-disable-next-line no-console
        console.error("[square-webhook] recordSquarePayment failed", {
          message: (err as Error).message,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
