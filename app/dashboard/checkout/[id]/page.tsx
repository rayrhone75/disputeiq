import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getUserPacketUsage } from "@/lib/billing/usage";
import { PLANS, formatCents } from "@/lib/billing/plans";
import { CheckoutConfirm } from "./checkout-confirm";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const dc = await prisma.disputeCase.findUnique({
    where: { id },
    include: { tradeline: true },
  });
  if (!dc || dc.userId !== user.id) notFound();

  const usage = await getUserPacketUsage(user.id);
  let totalCents: number;
  let chargeLabel: string;

  if (user.isGraceUser) {
    totalCents = 0;
    chargeLabel = "Grace account — fee waived";
  } else if (usage.plan && usage.remaining > 0) {
    totalCents = 0;
    chargeLabel = `Included in your ${PLANS[usage.plan].name} plan (${usage.remaining} remaining)`;
  } else if (usage.plan) {
    totalCents = usage.overagePriceCents;
    chargeLabel = `Extra packet — ${formatCents(totalCents)}`;
  } else {
    // No subscription — charge overage rate as one-off
    totalCents = 1995;
    chargeLabel = `One-time packet — ${formatCents(totalCents)}`;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <CheckoutConfirm
        disputeCaseId={dc.id}
        creditor={dc.tradeline?.creditorName ?? "Packet"}
        reason={dc.aiReasonSummary}
        totalCents={totalCents}
        isGrace={user.isGraceUser}
        chargeLabel={chargeLabel}
        planName={usage.plan ? PLANS[usage.plan].name : null}
        packetsUsed={usage.used}
        packetsIncluded={usage.included}
      />
    </div>
  );
}
