import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ReportWorkspace } from "./report-workspace";
import { Surface } from "@/components/ui/primitives";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" });
  const { id } = await params;

  const report = await fetchQuery(
    api.creditReports.getOwnedReport,
    { id: id as Id<"creditReports"> },
    { token: token ?? undefined },
  );
  if (!report) notFound();

  const tradelines = report.tradelines;
  const collections = tradelines.filter((t) => t.isCollection).length;
  const bureaus = [...new Set(tradelines.map((t) => t.bureau))];

  return (
    <div className="space-y-6">
      {/* Report header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-fg-muted hover:underline">
            ← All reports
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-fg">Credit report workspace</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
            <span>Imported {new Date(report.pulledAt).toLocaleDateString()}</span>
            <span className="text-fg-subtle">·</span>
            <span>
              {report.source === "IDENTITYIQ" || report.source === "MYSCOREIQ"
                ? "IdentityIQ"
                : report.source === "MYFREESCORENOW"
                  ? "MyFreeScoreNow (legacy)"
                  : "Manual upload"}
            </span>
            <span className="text-fg-subtle">·</span>
            <span>{tradelines.length} account(s)</span>
            {collections > 0 && (
              <>
                <span className="text-fg-subtle">·</span>
                <span className="text-rose-600 font-semibold">{collections} collection(s)</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bureaus.map((b) => (
            <span
              key={b}
              className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700"
            >
              {b === "Equifax" ? "EQ" : b === "Experian" ? "EX" : b === "TransUnion" ? "TU" : b}
            </span>
          ))}
        </div>
      </div>

      {/* Score notice */}
      <Surface className="p-4 text-center text-sm text-fg-muted">
        Credit scores are not imported from uploaded reports. Your scores are available directly in your IdentityIQ account.
      </Surface>

      {tradelines.length === 0 ? (
        <Surface className="p-10 text-center">
          <h2 className="text-lg font-semibold text-fg">No accounts parsed</h2>
          <p className="mt-2 text-sm text-fg-muted">
            The parser could not extract tradelines from this report. Try re-uploading a different
            PDF or using the paste-text import.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/dashboard/reports" className="rounded-lg bg-fg px-4 py-2 text-xs font-semibold text-canvas hover:bg-fg/90">
              Upload again
            </Link>
          </div>
        </Surface>
      ) : (
        <ReportWorkspace
          reportId={report._id as unknown as string}
          tradelines={tradelines.map((t) => ({
            id: t._id as unknown as string,
            bureau: t.bureau,
            creditor: t.creditorName,
            account: t.accountRefMasked,
            balanceCents: t.balanceCents ?? null,
            status: t.statusLabel ?? null,
            isCollection: t.isCollection,
            isMedical: t.isMedical,
          }))}
        />
      )}
    </div>
  );
}
