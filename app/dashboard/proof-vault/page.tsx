import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { ProofVaultGrid, type VaultEntry } from "@/components/dashboard/ProofVaultGrid";

export const metadata = { title: "Proof Vault — DisputeIQ" };

export default async function ProofVaultPage() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) redirect("/");

  const attachments = await fetchQuery(
    api.proofVault.listForCurrentUser,
    {},
    { token },
  );

  const entries: VaultEntry[] = attachments.map((a) => ({
    id: a.id,
    disputeCaseId: a.disputeCaseId,
    kind: a.kind,
    createdAt: new Date(a.createdAt).toISOString(),
    creditor: a.creditor,
    bureau: a.bureau,
    status: a.status,
    classification: a.classification,
    recommendation: a.recommendation,
    reasoning: a.reasoning,
  }));

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
