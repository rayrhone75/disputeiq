import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import {
  draftRedispute,
  draftMOV,
  draftCFPB,
  draftDirectFurnisher,
} from "@/lib/ai/escalation";

// Unified escalation endpoint. Takes a prior dispute case and generates the
// next-stage letter based on the chosen escalation path.
const schema = z.object({
  stage: z.enum(["redispute", "mov", "cfpb", "direct_furnisher"]),
});

const LETTER_TYPE_MAP = {
  redispute: "FACTUAL_DISPUTE" as const,
  mov: "MOV_REQUEST" as const,
  cfpb: "CFPB_PACKET" as const,
  direct_furnisher: "DIRECT_FURNISHER" as const,
};

const BUREAU_NAMES: Record<string, string> = {
  EQUIFAX: "Equifax Information Services LLC",
  EXPERIAN: "Experian",
  TRANSUNION: "TransUnion LLC Consumer Dispute Center",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { stage } = parsed.data;

  const prior = await prisma.disputeCase.findUnique({
    where: { id },
    include: { tradeline: true, mailJobs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!prior) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (prior.userId !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 400 });

  const consumer = {
    fullName: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  const escCtx = {
    consumer,
    creditor: prior.tradeline?.creditorName ?? "Unknown Creditor",
    accountRefMasked: prior.tradeline?.accountRefMasked ?? "••••",
    bureau: prior.tradeline?.bureau ?? "Unknown",
    priorCaseId: prior.id,
    priorReason: prior.aiReasonSummary,
    priorMailedAt: prior.mailedAt?.toISOString().slice(0, 10),
    priorDeliveredAt: prior.deliveredAt?.toISOString().slice(0, 10),
    balanceCents: prior.tradeline?.balanceCents,
    statusLabel: prior.tradeline?.statusLabel,
  };

  let result;
  if (stage === "redispute") {
    result = await draftRedispute(escCtx);
  } else if (stage === "mov") {
    result = await draftMOV(escCtx);
  } else if (stage === "cfpb") {
    // Build timeline from audit logs
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "DisputeCase", entityId: prior.id },
      orderBy: { createdAt: "asc" },
    });
    const timeline = logs.map((l) => ({
      date: l.createdAt.toISOString().slice(0, 10),
      action: l.action,
      result: JSON.stringify(l.metadataJson).slice(0, 200),
    }));
    result = await draftCFPB({ ...escCtx, disputeTimeline: timeline });
  } else {
    result = await draftDirectFurnisher(escCtx);
  }

  // Generate PDF
  const bureauKey = (prior.tradeline?.bureau ?? "").toUpperCase();
  const recipientName = stage === "direct_furnisher"
    ? escCtx.creditor
    : BUREAU_NAMES[bureauKey] ?? escCtx.bureau;

  const pdf = buildLetterPdf({
    senderBlock: [consumer.fullName, consumer.address1, `${consumer.city}, ${consumer.state} ${consumer.zip}`],
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    recipientBlock: [recipientName],
    subject: `${stage === "cfpb" ? "CFPB Complaint" : "Escalated dispute"} — account ${escCtx.accountRefMasked}`,
    body: result.bodyText,
    signatureName: consumer.fullName,
  });

  const pdfRef = await storage.put(
    `letters/${user.id}/escalation_${stage}_${Date.now()}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  const newCase = await prisma.disputeCase.create({
    data: {
      userId: user.id,
      tradelineId: prior.tradelineId,
      letterType: LETTER_TYPE_MAP[stage],
      aiReasonSummary: `${stage.toUpperCase()} escalation of case ${prior.id}`,
      legalBasisSummary: result.legalBasis,
      status: "DRAFT",
      secureLetterRef: pdfRef,
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: `ESCALATION_${stage.toUpperCase()}`,
    entityType: "DisputeCase",
    entityId: newCase.id,
    metadataJson: { priorCaseId: prior.id, stage, aiLive: result.aiLive, pages: pdf.pages },
  });

  return NextResponse.json({
    newDisputeCaseId: newCase.id,
    priorDisputeCaseId: prior.id,
    stage,
    pages: pdf.pages,
    legalBasis: result.legalBasis,
    aiLive: result.aiLive,
    bodyText: result.bodyText,
  });
}
