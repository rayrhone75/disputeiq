import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { requireUser } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getUserPacketUsage } from "@/lib/billing/usage";
import { PLANS, formatCents } from "@/lib/billing/plans";
import { CheckoutConfirm } from "./checkout-confirm";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireUser();
  const { id } = await params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) notFound();

  const dcRow = await fetchQuery(
    api.payments.disputeCaseForCheckout,
    { id: id as Id<"disputeCases"> },
    { token },
  );
  if (!dcRow) notFound();

  const dc = dcRow.case;
  const tradeline = dcRow.tradeline;

  const usage = await getUserPacketUsage();
  let totalCents: number;
  let chargeLabel: string;

  if (sessionUser.isGraceUser) {
    totalCents = 0;
    chargeLabel = "Grace account — fee waived";
  } else if (usage.plan && usage.remaining > 0) {
    totalCents = 0;
    chargeLabel = `Included in your ${PLANS[usage.plan].name} plan (${usage.remaining} remaining)`;
  } else if (usage.plan) {
    totalCents = usage.overagePriceCents;
    chargeLabel = `Extra packet — ${formatCents(totalCents)}`;
  } else {
    totalCents = 1995;
    chargeLabel = `One-time packet — ${formatCents(totalCents)}`;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <CheckoutConfirm
        disputeCaseId={dc._id as unknown as string}
        creditor={tradeline?.creditorName ?? "Packet"}
        reason={dc.aiReasonSummary}
        totalCents={totalCents}
        isGrace={sessionUser.isGraceUser}
        chargeLabel={chargeLabel}
        planName={usage.plan ? PLANS[usage.plan].name : null}
        packetsUsed={usage.used}
        packetsIncluded={usage.included}
      />
    </div>
  );
}
