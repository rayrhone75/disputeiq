import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { NewImportPanel } from "@/components/admin/credit-imports/NewImportPanel";

export const dynamic = "force-dynamic";

export default async function NewCreditImportPage() {
  await requireRole(["OWNER", "ADMIN"]);

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="New credit import"
        description="Create an import job, then capture the raw JSON (fetch or paste) and run normalization."
      />
      <Surface className="p-6">
        <NewImportPanel users={users} />
      </Surface>
    </div>
  );
}
