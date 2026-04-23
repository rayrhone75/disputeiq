import { requireRole } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { SupportSearch } from "@/components/admin/support/SupportSearch";

export const dynamic = "force-dynamic";

export default async function SupportHubPage() {
  await requireRole(["OWNER", "ADMIN", "SUPPORT"]);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support"
        title="Customer support hub"
        description="One operational screen: find a customer, open their console, resolve the issue."
      />
      <Surface className="p-6">
        <SupportSearch />
      </Surface>
    </div>
  );
}
