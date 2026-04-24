import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface } from "@/components/ui/primitives";
import { NewImportPanel } from "@/components/admin/credit-imports/NewImportPanel";

export const dynamic = "force-dynamic";

export default async function NewCreditImportPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });

  let users: Array<{ id: string; email: string }> = [];
  try {
    const rows = await fetchQuery(
      api.creditImports.adminListUsers,
      { limit: 200 },
      { token: token ?? undefined },
    );
    users = rows.map((u) => ({ id: u.id as unknown as string, email: u.email }));
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

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
