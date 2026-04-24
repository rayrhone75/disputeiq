import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decrypt } from "@/lib/encryption";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
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
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { stage } = parsed.data;

  const caseBundle = await fetchQuery(
    api.disputes.getById,
    { id: id as Id<"disputeCases"> },
    { token },
  );
  if (!caseBundle) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const prior = caseBundle.case;
  const tradeline = caseBundle.tradeline;
  const latestMailJob = caseBundle.latestMailJob;
  const auditLogs = caseBundle.auditLogs;

  const profile = await fetchQuery(api.disputes.userProfileForLetter, {}, { token });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 400 });

  const consumer = {
    fullName: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  const priorMailedAt = prior.mailedAt
    ? new Date(prior.mailedAt).toISOString().slice(0, 10)
    : latestMailJob?.mailedAt
    ? new Date(latestMailJob.mailedAt).toISOString().slice(0, 10)
    : undefined;
  const priorDeliveredAt = prior.deliveredAt
    ? new Date(prior.deliveredAt).toISOString().slice(0, 10)
    : latestMailJob?.deliveredAt
    ? new Date(latestMailJob.deliveredAt).toISOString().slice(0, 10)
    : undefined;

  const escCtx = {
    consumer,
    creditor: tradeline?.creditorName ?? "Unknown Creditor",
    accountRefMasked: tradeline?.accountRefMasked ?? "••••",
    bureau: tradeline?.bureau ?? "Unknown",
    priorCaseId: prior._id as unknown as string,
    priorReason: prior.aiReasonSummary,
    priorMailedAt,
    priorDeliveredAt,
    balanceCents: tradeline?.balanceCents,
    statusLabel: tradeline?.statusLabel,
  };

  let result;
  if (stage === "redispute") {
    result = await draftRedispute(escCtx);
  } else if (stage === "mov") {
    result = await draftMOV(escCtx);
  } else if (stage === "cfpb") {
    // Build timeline from audit logs
    const timeline = auditLogs.map((l) => ({
      date: new Date(l.createdAt).toISOString().slice(0, 10),
      action: l.action,
      result: JSON.stringify(l.metadataJson).slice(0, 200),
    }));
    result = await draftCFPB({ ...escCtx, disputeTimeline: timeline });
  } else {
    result = await draftDirectFurnisher(escCtx);
  }

  // Generate PDF
  const bureauKey = (tradeline?.bureau ?? "").toUpperCase();
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
    `letters/${userId}/escalation_${stage}_${Date.now()}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  const created = await fetchMutation(
    api.disputes.createEscalation,
    {
      priorId: prior._id,
      letterType: LETTER_TYPE_MAP[stage],
      aiReasonSummary: `${stage.toUpperCase()} escalation of case ${prior._id}`,
      legalBasisSummary: result.legalBasis,
      secureLetterRef: pdfRef,
      auditAction: `ESCALATION_${stage.toUpperCase()}`,
      auditMetadata: { stage, aiLive: result.aiLive, pages: pdf.pages },
      // The escalate flow used to leave the prior case alone; the redispute
      // route is the one that closes it. Mirror that here.
      closePrior: false,
    },
    { token },
  );

  return NextResponse.json({
    newDisputeCaseId: created.newId,
    priorDisputeCaseId: prior._id,
    stage,
    pages: pdf.pages,
    legalBasis: result.legalBasis,
    aiLive: result.aiLive,
    bodyText: result.bodyText,
  });
}
