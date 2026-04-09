import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ReportFlow } from "./report-flow";
import { PageHeader, Surface } from "@/components/ui/primitives";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const report = await prisma.creditReport.findUnique({
    where: { id },
    include: { tradelines: true },
  });
  if (!report || report.userId !== user.id) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Credit report"
        title="Analyze, draft, and send disputes"
        description="Run AI analysis on this report, review the findings, draft a real dispute letter, and send it via certified mail."
      />
      <Surface className="p-6">
        <ReportFlow
          reportId={report.id}
          tradelines={report.tradelines.map((t) => ({
            id: t.id,
            bureau: t.bureau,
            creditor: t.creditorName,
            account: t.accountRefMasked,
            balanceCents: t.balanceCents,
            status: t.statusLabel,
          }))}
        />
      </Surface>
    </div>
  );
}
