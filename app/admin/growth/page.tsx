import { requireRole } from "@/lib/auth";
import { GrowthConsole } from "./growth-console";

export default async function AdminGrowthPage() {
  await requireRole(["OWNER", "ADMIN"]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Growth console</h1>
        <p className="text-sm text-ink-600">
          AI-assisted content generator, comment responder, and inbound DM helper. Every generation is logged in the audit trail.
        </p>
      </header>
      <GrowthConsole />
    </div>
  );
}
