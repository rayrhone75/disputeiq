import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button, Chip, PageHeader, Surface } from "@/components/ui/primitives";
import type { CreditImportStatus, CreditProvider, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: CreditImportStatus[] = [
  "PENDING",
  "FETCHED",
  "VALIDATED",
  "NORMALIZED",
  "FAILED",
  "ARCHIVED",
];
const PROVIDERS: CreditProvider[] = ["IDENTITYIQ", "MYSCOREIQ", "MYFREESCORENOW", "MANUAL"];

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
  await requireRole(["OWNER", "ADMIN"]);
  const q = (await searchParams) ?? {};

  const where: Prisma.CreditReportImportWhereInput = {};
  if (q.status && STATUSES.includes(q.status as CreditImportStatus)) {
    where.status = q.status as CreditImportStatus;
  }
  if (q.provider && PROVIDERS.includes(q.provider as CreditProvider)) {
    where.provider = q.provider as CreditProvider;
  }
  if (q.userId) where.userId = q.userId;
  if (q.email) where.user = { email: { contains: q.email, mode: "insensitive" } };

  const imports = await prisma.creditReportImport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
      _count: {
        select: {
          tradelines: true,
          inquiries: true,
          collections: true,
          publicRecords: true,
          disputeCandidates: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Credit report imports"
        description="IdentityIQ and MyScoreIQ JSON ingestion — create, capture, normalize, inspect."
        actions={
          <Button href="/admin/credit-imports/new" variant="primary">
            New import
          </Button>
        }
      />

      <Surface className="p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-ink-500">Status</span>
            <select
              name="status"
              defaultValue={q.status ?? ""}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1"
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
            <span className="font-semibold text-ink-500">Provider</span>
            <select
              name="provider"
              defaultValue={q.provider ?? ""}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1"
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
            <span className="font-semibold text-ink-500">Email contains</span>
            <input
              name="email"
              defaultValue={q.email ?? ""}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-ink-500">User id</span>
            <input
              name="userId"
              defaultValue={q.userId ?? ""}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1 font-mono"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-ink-900 px-3 py-1.5 font-semibold text-white"
          >
            Filter
          </button>
          <Link
            href="/admin/credit-imports"
            className="rounded-lg border border-ink-200 px-3 py-1.5 font-semibold text-ink-700"
          >
            Clear
          </Link>
        </form>
      </Surface>

      {imports.length === 0 ? (
        <Surface className="p-6">
          <p className="text-sm text-ink-600">
            No credit imports match these filters.
          </p>
        </Surface>
      ) : (
        <Surface className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Provider</th>
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
                <tr key={imp.id} className="border-t border-ink-100">
                  <td className="py-2 pr-3 font-mono">{imp.user.email}</td>
                  <td className="py-2 pr-3">{imp.provider}</td>
                  <td className="py-2 pr-3">{imp.createdAt.toLocaleDateString()}</td>
                  <td className="py-2 pr-3">
                    <Chip tone={STATUS_TONE[imp.status] ?? "neutral"}>{imp.status}</Chip>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[10px]">
                    {imp.bureauCoverage.length ? imp.bureauCoverage.join(",") : "—"}
                  </td>
                  <td className="py-2 pr-3">{imp._count.tradelines}</td>
                  <td className="py-2 pr-3">{imp._count.collections}</td>
                  <td className="py-2 pr-3">{imp._count.publicRecords}</td>
                  <td className="py-2 pr-3">{imp._count.inquiries}</td>
                  <td className="py-2 pr-3 font-semibold">{imp._count.disputeCandidates}</td>
                  <td className="py-2 pr-3 text-danger-600">
                    {imp.errorCode ? imp.errorCode : ""}
                  </td>
                  <td className="py-2 pr-3">
                    <Link className="text-accent-600 underline" href={`/admin/credit-imports/${imp.id}`}>
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
