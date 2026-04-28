import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PageHeader, Surface, SectionHeader } from "@/components/ui/primitives";
import { ReportUploader } from "@/components/dashboard/ReportUploader";
import { ReportPasteImport } from "@/components/dashboard/ReportPasteImport";

export default async function ReportsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });

  const reports = await fetchQuery(
    api.creditReports.listForCurrentUser,
    {},
    { token: token ?? undefined },
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reports"
        title="Your credit reports"
        description="Upload your tri-merge PDF. We parse tradelines across all three bureaus and surface what's disputable."
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <Surface className="lg:col-span-2 p-8 space-y-8">
          <div>
            <SectionHeader title="Upload PDF report" />
            <ReportUploader />
          </div>
          <div className="border-t border-border pt-6">
            <ReportPasteImport />
          </div>
        </Surface>

        <Surface className="p-8">
          <SectionHeader title="Report history" />
          {reports.length === 0 ? (
            <p className="text-sm text-fg-muted">
              No reports uploaded yet. Activate MyScoreIQ and then connect your 3-bureau report.
            </p>
          ) : (
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Reports</dt>
                <dd className="font-medium text-fg">{reports.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Latest</dt>
                <dd className="font-medium text-fg">
                  {new Date(reports[0].pulledAt).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-muted">Tradelines</dt>
                <dd className="font-medium text-fg">
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
          <ul className="mt-4 divide-y divide-border text-sm">
            {reports.map((r) => (
              <li key={r._id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-semibold text-fg">
                    {r.source === "MYSCOREIQ" || r.source === "IDENTITYIQ"
                      ? "MyScoreIQ"
                      : r.source === "MYFREESCORENOW"
                        ? "Legacy upload"
                        : "Manual upload"}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {new Date(r.pulledAt).toLocaleDateString()} · {r.tradelines.length} tradelines
                  </div>
                </div>
                <Link
                  href={`/dashboard/reports/${r._id}`}
                  className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-fg/90"
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
