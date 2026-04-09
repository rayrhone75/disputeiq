import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PACKET_PRICE_CENTS } from "@/lib/pricing";
import { CheckoutConfirm } from "./checkout-confirm";

// Pre-payment review + consent screen. This is the gate between "Draft ready"
// and Square checkout. We show packet count, total price, what happens next,
// and the four required consent checkboxes. Only when all four are accepted
// does the client call /api/payments/create-checkout with `checkoutConsents`,
// which writes a ConsentReceipt and then issues the Square payment link.
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const dc = await prisma.disputeCase.findUnique({
    where: { id },
    include: { tradeline: true },
  });
  if (!dc || dc.userId !== user.id) notFound();

  const isGrace = user.isGraceUser;
  const totalCents = isGrace ? 0 : PACKET_PRICE_CENTS;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <CheckoutConfirm
        disputeCaseId={dc.id}
        creditor={dc.tradeline?.creditorName ?? "Packet"}
        reason={dc.aiReasonSummary}
        totalCents={totalCents}
        isGrace={isGrace}
      />
    </div>
  );
}
