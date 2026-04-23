import { requireRole } from "@/lib/auth";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { loadIdiqConfig } from "@/lib/integrations/identityiq";
import { IdiqSettingsForm } from "@/components/admin/settings/IdiqSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole(["OWNER", "ADMIN"]);
  const config = await loadIdiqConfig();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Platform settings"
        description="Manage the IDIQ affiliate flow, onboarding copy, and feature flags. Changes take effect immediately — no deploy required."
      />
      <Surface className="p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">
          IdentityIQ (supported report provider)
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          IDIQ is the supported report source for every new DisputeIQ customer. These fields
          drive the onboarding CTA, the customer-facing copy, and the admin/support view.
        </p>
        <div className="mt-5">
          <IdiqSettingsForm initial={config} />
        </div>
      </Surface>
    </div>
  );
}
