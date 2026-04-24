import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { analyzeReport } from "@/lib/ai/analyze-report";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  const report = await fetchQuery(
    api.creditReports.getOwnedReport,
    { id: id as Id<"creditReports"> },
    { token: token ?? undefined },
  );
  if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // analyzeReport historically expected the Prisma `Tradeline` shape — the
  // Convex `tradelines` table has the same conceptual fields but uses
  // millisecond timestamps and Convex `Id` strings. Re-shape into what
  // analyzeReport reads (id, bureau, creditorName, accountRefMasked,
  // balanceCents, statusLabel, isCollection, isMedical).
  const adapted = report.tradelines.map((t) => ({
    id: t._id as unknown as string,
    reportId: t.reportId as unknown as string,
    bureau: t.bureau,
    creditorName: t.creditorName,
    accountRefMasked: t.accountRefMasked,
    balanceCents: t.balanceCents ?? null,
    pastDueCents: t.pastDueCents ?? null,
    statusLabel: t.statusLabel ?? null,
    openedAt: t.openedAt ? new Date(t.openedAt) : null,
    lastReportedAt: t.lastReportedAt ? new Date(t.lastReportedAt) : null,
    lastActivityAt: t.lastActivityAt ? new Date(t.lastActivityAt) : null,
    isCollection: t.isCollection,
    isMedical: t.isMedical,
    isFraudClaimed: t.isFraudClaimed,
  })) as unknown as Parameters<typeof analyzeReport>[0];

  const result = await analyzeReport(adapted);

  await fetchMutation(
    api.creditReports.writeReportAnalyzedAudit,
    {
      reportId: id as Id<"creditReports">,
      findings: result.findings.length,
      aiLive: result.aiLive,
    },
    { token: token ?? undefined },
  );

  return NextResponse.json(result);
}
