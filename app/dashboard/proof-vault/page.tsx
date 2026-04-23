import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { ProofVaultGrid, type VaultEntry } from "@/components/dashboard/ProofVaultGrid";

export const metadata = { title: "Proof Vault — DisputeIQ" };

export default async function ProofVaultPage() {
  const user = await requireUser();

  const attachments = await prisma.caseAttachment.findMany({
    where: { disputeCase: { userId: user.id } },
    include: {
      disputeCase: { include: { tradeline: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Pull audit logs that carry AI verdicts so we can attach them to entries.
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "BUREAU_RESPONSE_UPLOADED",
      entityType: "DisputeCase",
      entityId: { in: attachments.map((a) => a.disputeCaseId) },
    },
  });

  const verdictByAttachment = new Map<
    string,
    { classification?: string; recommendation?: string; reasoning?: string }
  >();
  for (const l of logs) {
    const m = (l.metadataJson ?? {}) as Record<string, unknown>;
    const attachmentId = typeof m.attachmentId === "string" ? m.attachmentId : undefined;
    if (!attachmentId) continue;
    verdictByAttachment.set(attachmentId, {
      classification: typeof m.classification === "string" ? m.classification : undefined,
      recommendation: typeof m.recommendation === "string" ? m.recommendation : undefined,
      reasoning: typeof m.reasoning === "string" ? m.reasoning : undefined,
    });
  }

  const entries: VaultEntry[] = attachments.map((a) => {
    const v = verdictByAttachment.get(a.id) ?? {};
    return {
      id: a.id,
      disputeCaseId: a.disputeCaseId,
      kind: a.kind,
      createdAt: a.createdAt.toISOString(),
      creditor: a.disputeCase.tradeline?.creditorName ?? "Bureau packet",
      bureau: a.disputeCase.tradeline?.bureau ?? "—",
      status: a.disputeCase.status,
      ...v,
    };
  });

  const totals = {
    all: entries.length,
    deleted: entries.filter((e) => e.classification === "deleted").length,
    stall: entries.filter((e) => e.classification === "stall").length,
    verified: entries.filter((e) => e.classification === "verified").length,
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Proof Vault"
        title="Every bureau response, parsed and filed"
        description="Uploaded response letters, classified by AI, linked to the originating dispute and ready for escalation."
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Surface className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Total filed
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">{totals.all}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            Deleted
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">{totals.deleted}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
            Stall
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">{totals.stall}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
            Verified (needs re-dispute)
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">{totals.verified}</p>
        </Surface>
      </section>

      <ProofVaultGrid entries={entries} />
    </div>
  );
}
