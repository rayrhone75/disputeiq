import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { callClaude } from "@/lib/ai/client";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/audit";

// Auto re-dispute — generates a stronger follow-up letter that references the
// prior attempt, cites FCRA §611(a)(5)(A), §611(a)(6)(B)(iii), and §611(a)(7),
// and demands Method of Verification. Creates a NEW DisputeCase anchored on
// the same tradeline, with its own secureLetterRef. Still goes through the
// normal Draft → Confirm → Square checkout → dispatch pipeline.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const prior = await prisma.disputeCase.findUnique({
    where: { id },
    include: { tradeline: true },
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

  const grounding = `PRIOR DISPUTE REFERENCE: case ${prior.id}
ACCOUNT: ${prior.tradeline?.creditorName ?? "—"} — ${prior.tradeline?.accountRefMasked ?? "—"}
BUREAU: ${prior.tradeline?.bureau ?? "—"}
PRIOR BASIS: ${prior.aiReasonSummary}
PRIOR LEGAL CITATION: ${prior.legalBasisSummary ?? "FCRA §611"}
PRIOR OUTCOME: bureau failed to delete or provided an inadequate response.

Generate a STRONGER follow-up dispute letter body. Requirements:
(1) Reference the prior dispute by case id and date.
(2) Cite FCRA §611(a)(6)(B)(iii) demanding Method of Verification (names of everyone contacted, description of procedure).
(3) Cite §611(a)(7) putting the bureau on notice of reinsertion rules.
(4) Cite §616/§617 on civil liability if the bureau continues to report unverified information.
(5) Demand deletion within 15 days (not the full 30) given that this is a second request.
(6) Formal, firm, non-threatening tone.
(7) Use ONLY the facts given. Do not invent account numbers, balances, dates, or prior response language.
(8) Do NOT include the consumer address block, the date, or a salutation — those are added by the renderer.`;

  const ai = await callClaude({
    model: "opus",
    system:
      "You are a senior paralegal drafting a second-round FCRA dispute letter. The tone is firmer and the legal pressure is higher than a first-round dispute. Output ONLY the letter body text.",
    user: grounding,
    maxTokens: 1500,
  });

  const pdf = buildLetterPdf({
    senderBlock: [
      consumer.fullName,
      consumer.address1,
      `${consumer.city}, ${consumer.state} ${consumer.zip}`,
    ],
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    recipientBlock: [prior.tradeline?.bureau ?? "Credit Bureau"],
    subject: `SECOND NOTICE — FCRA §611 follow-up on dispute ${prior.id}`,
    body: ai.text.trim(),
    signatureName: consumer.fullName,
  });

  const pdfRef = await storage.put(
    `letters/${user.id}/redispute_${Date.now()}_${prior.id}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  const newCase = await prisma.disputeCase.create({
    data: {
      userId: user.id,
      tradelineId: prior.tradelineId,
      letterType: "MOV_REQUEST",
      aiReasonSummary: `Re-dispute of case ${prior.id}: bureau failed to delete or provided inadequate response. MOV requested.`,
      legalBasisSummary: "FCRA §611(a)(6)(B)(iii) + §611(a)(7) + §616/§617",
      status: "DRAFT",
      secureLetterRef: pdfRef,
    },
  });

  // Close the prior case so it doesn't keep showing as actionable
  await prisma.disputeCase.update({
    where: { id: prior.id },
    data: { status: "ESCALATION_READY" },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "DISPUTE_REDRAFTED",
    entityType: "DisputeCase",
    entityId: newCase.id,
    metadataJson: {
      priorCaseId: prior.id,
      aiLive: ai.live,
      pages: pdf.pages,
      pdfRef,
    },
  });

  return NextResponse.json({
    newDisputeCaseId: newCase.id,
    priorDisputeCaseId: prior.id,
    pages: pdf.pages,
    aiLive: ai.live,
    bodyText: ai.text.trim(),
  });
}
