import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, Surface, SectionHeader } from "@/components/ui/primitives";
import { ReportUploader } from "@/components/dashboard/ReportUploader";

export default async function ReportsPage() {
  const user = await requireUser();
  const reports = await prisma.creditReport.findMany({
    where: { userId: user.id },
    include: { tradelines: true },
    orderBy: { pulledAt: "desc" },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reports"
        title="Your credit reports"
        description="Upload your tri-merge PDF. We parse tradelines across all three bureaus and surface what's disputable."
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <Surface className="lg:col-span-2 p-8">
          <SectionHeader title="Upload a new report" />
          <ReportUploader />
        </Surface>

        <Surface className="p-8">
          <SectionHeader title="Report history" />
          {reports.length === 0 ? (
            <p className="text-sm text-ink-500">
              No reports uploaded yet. Upload your MyFreeScoreIQ tri-merge PDF to get started.
            </p>
          ) : (
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Reports</dt>
                <dd className="font-medium text-ink-900">{reports.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Latest</dt>
                <dd className="font-medium text-ink-900">
                  {reports[0].pulledAt.toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Tradelines</dt>
                <dd className="font-medium text-ink-900">
                  {reports[0].tradelines.length}
                </dd>
              </div>
            </dl>
          )}
        </Surface>
      </section>

      {reports.length > 0 && (
        <Surface className="p-8">
          <SectionHeader title="Your reports" />
          <ul className="mt-4 divide-y divide-ink-100 text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold text-ink-900">
                    {r.source === "MYFREESCORENOW" ? "MyFreeScoreIQ" : "Manual upload"}
                  </div>
                  <div className="text-xs text-ink-500">
                    {r.pulledAt.toLocaleDateString()} · {r.tradelines.length} tradelines
                  </div>
                </div>
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Analyze →
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}
