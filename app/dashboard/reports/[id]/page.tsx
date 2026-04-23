import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ReportWorkspace } from "./report-workspace";
import { Surface } from "@/components/ui/primitives";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const report = await prisma.creditReport.findUnique({
    where: { id },
    include: { tradelines: true },
  });
  if (!report || report.userId !== user.id) notFound();

  const tradelines = report.tradelines;
  const collections = tradelines.filter((t) => t.isCollection).length;
  const bureaus = [...new Set(tradelines.map((t) => t.bureau))];

  return (
    <div className="space-y-6">
      {/* Report header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-ink-500 hover:underline">
            ← All reports
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">Credit report workspace</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-600">
            <span>Imported {report.pulledAt.toLocaleDateString()}</span>
            <span className="text-ink-300">·</span>
            <span>
              {report.source === "IDENTITYIQ" || report.source === "MYSCOREIQ"
                ? "IdentityIQ"
                : report.source === "MYFREESCORENOW"
                  ? "MyFreeScoreNow (legacy)"
                  : "Manual upload"}
            </span>
            <span className="text-ink-300">·</span>
            <span>{tradelines.length} account(s)</span>
            {collections > 0 && (
              <>
                <span className="text-ink-300">·</span>
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
      <Surface className="p-4 text-center text-sm text-ink-600">
        Credit scores are not imported from uploaded reports. Your scores are available directly in your IdentityIQ account.
      </Surface>

      {tradelines.length === 0 ? (
        <Surface className="p-10 text-center">
          <h2 className="text-lg font-semibold text-ink-900">No accounts parsed</h2>
          <p className="mt-2 text-sm text-ink-600">
            The parser could not extract tradelines from this report. Try re-uploading a different
            PDF or using the paste-text import.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/dashboard/reports" className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white">
              Upload again
            </Link>
          </div>
        </Surface>
      ) : (
        <ReportWorkspace
          reportId={report.id}
          tradelines={tradelines.map((t) => ({
            id: t.id,
            bureau: t.bureau,
            creditor: t.creditorName,
            account: t.accountRefMasked,
            balanceCents: t.balanceCents,
            status: t.statusLabel,
            isCollection: t.isCollection,
            isMedical: t.isMedical,
          }))}
        />
      )}
    </div>
  );
}
