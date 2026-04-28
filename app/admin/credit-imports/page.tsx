import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Chip, PageHeader, Surface } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const STATUSES = [
  "PENDING",
  "FETCHED",
  "VALIDATED",
  "NORMALIZED",
  "FAILED",
  "ARCHIVED",
] as const;
type Status = (typeof STATUSES)[number];

// Filter dropdown order — MYSCOREIQ first since it's the active provider.
// IDENTITYIQ stays on the list for filtering legacy rows that still hold the
// older enum value.
const PROVIDERS = ["MYSCOREIQ", "IDENTITYIQ", "MYFREESCORENOW", "MANUAL"] as const;
type Provider = (typeof PROVIDERS)[number];

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  FETCHED: "accent",
  VALIDATED: "accent",
  NORMALIZED: "success",
  FAILED: "danger",
  ARCHIVED: "neutral",
};

export default async function AdminCreditImportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    provider?: string;
    userId?: string;
    email?: string;
  }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });
  const q = (await searchParams) ?? {};

  let imports: Awaited<ReturnType<typeof fetchQuery<typeof api.creditImports.adminList>>>["imports"] = [];
  try {
    const result = await fetchQuery(
      api.creditImports.adminList,
      {
        status:
          q.status && (STATUSES as readonly string[]).includes(q.status)
            ? (q.status as Status)
            : undefined,
        provider:
          q.provider && (PROVIDERS as readonly string[]).includes(q.provider)
            ? (q.provider as Provider)
            : undefined,
        userId: q.userId ? (q.userId as Id<"users">) : undefined,
        emailContains: q.email || undefined,
        limit: 100,
        offset: 0,
      },
      { token: token ?? undefined },
    );
    imports = result.imports;
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") redirect("/dashboard");
    throw err;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Credit report imports"
        description="MyScoreIQ JSON ingestion (IdentityIQ legacy supported) — create, capture, normalize, inspect."
        actions={
          <Button href="/admin/credit-imports/new" variant="primary">
            New import
          </Button>
        }
      />

      <Surface className="p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-fg-muted">Status</span>
            <select
              name="status"
              defaultValue={q.status ?? ""}
              className="rounded-lg border border-border-strong bg-surface px-2 py-1"
            >
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-fg-muted">Provider</span>
            <select
              name="provider"
              defaultValue={q.provider ?? ""}
              className="rounded-lg border border-border-strong bg-surface px-2 py-1"
            >
              <option value="">Any</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-fg-muted">Email contains</span>
            <input
              name="email"
              defaultValue={q.email ?? ""}
              className="rounded-lg border border-border-strong bg-surface px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-fg-muted">User id</span>
            <input
              name="userId"
              defaultValue={q.userId ?? ""}
              className="rounded-lg border border-border-strong bg-surface px-2 py-1 font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-fg px-3 py-1.5 font-semibold text-canvas hover:bg-fg/90"
          >
            Filter
          </button>
          <Link
            href="/admin/credit-imports"
            className="rounded-lg border border-border-strong px-3 py-1.5 font-semibold text-fg-muted"
          >
            Clear
          </Link>
        </form>
      </Surface>

      {imports.length === 0 ? (
        <Surface className="p-6">
          <p className="text-sm text-fg-muted">
            No credit imports match these filters.
          </p>
        </Surface>
      ) : (
        <Surface className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Bureaus</th>
                <th className="py-2 pr-3">TL</th>
                <th className="py-2 pr-3">Col</th>
                <th className="py-2 pr-3">PR</th>
                <th className="py-2 pr-3">Inq</th>
                <th className="py-2 pr-3">Cand</th>
                <th className="py-2 pr-3">Error</th>
                <th className="py-2 pr-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp._id} className="border-t border-border">
                  <td className="py-2 pr-3 font-mono">{imp.user?.email ?? "—"}</td>
                  <td className="py-2 pr-3">{imp.provider}</td>
                  <td className="py-2 pr-3 text-[10px] uppercase tracking-wide text-fg-muted">
                    {imp.importMethod ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {new Date(imp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3">
                    <Chip tone={STATUS_TONE[imp.status] ?? "neutral"}>
                      {imp.errorCode === "REQUIRES_USER_ACTION"
                        ? "REQUIRES_USER_ACTION"
                        : imp.status}
                    </Chip>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px]">
                    {imp.bureauCoverage.length ? imp.bureauCoverage.join(",") : "—"}
                  </td>
                  <td className="py-2 pr-3">{imp.counts.tradelines}</td>
                  <td className="py-2 pr-3">{imp.counts.collections}</td>
                  <td className="py-2 pr-3">{imp.counts.publicRecords}</td>
                  <td className="py-2 pr-3">{imp.counts.inquiries}</td>
                  <td className="py-2 pr-3 font-semibold">
                    {imp.counts.disputeCandidates}
                  </td>
                  <td className="py-2 pr-3 text-danger-600">
                    {imp.errorCode ? imp.errorCode : ""}
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      className="text-accent-600 underline"
                      href={`/admin/credit-imports/${imp._id}`}
                    >
                      open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </div>
  );
}
