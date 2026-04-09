import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { draftLetter } from "@/lib/ai/draft-letter";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  tradelineId: z.string(),
  letterType: z.enum(["FACTUAL_DISPUTE", "MOV_REQUEST", "DIRECT_FURNISHER", "IDENTITY_THEFT_605B"]),
  findingCode: z.string(),
  findingDetail: z.string(),
});

const BUREAU_NAMES: Record<string, string> = {
  EQUIFAX: "Equifax Information Services LLC",
  EXPERIAN: "Experian",
  TRANSUNION: "TransUnion LLC Consumer Dispute Center",
};

const BUREAU_ADDR: Record<string, string[]> = {
  EQUIFAX: ["P.O. Box 740256", "Atlanta, GA 30374"],
  EXPERIAN: ["P.O. Box 4500", "Allen, TX 75013"],
  TRANSUNION: ["P.O. Box 2000", "Chester, PA 19016"],
};

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const tradeline = await prisma.tradeline.findUnique({
    where: { id: body.tradelineId },
    include: { report: true },
  });
  if (!tradeline) return NextResponse.json({ error: "TRADELINE_NOT_FOUND" }, { status: 404 });
  if (tradeline.report.userId !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 400 });
  }

  const consumer = {
    fullName: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  const bureauKey = tradeline.bureau.toUpperCase();
  const recipientName = BUREAU_NAMES[bureauKey] ?? tradeline.creditorName;
  const recipientBlock = [recipientName, ...(BUREAU_ADDR[bureauKey] ?? ["ADDRESS ON FILE"])];

  // 1. AI-draft the letter body (real Claude when key set; deterministic offline fallback otherwise)
  const drafted = await draftLetter({
    letterType: body.letterType,
    consumer,
    recipientName,
    account: {
      creditor: tradeline.creditorName,
      accountRefMasked: tradeline.accountRefMasked,
      bureau: tradeline.bureau,
      balanceCents: tradeline.balanceCents,
      statusLabel: tradeline.statusLabel,
    },
    findingCode: body.findingCode,
    findingDetail: body.findingDetail,
  });

  // 2. Render the real PDF artifact
  const pdf = buildLetterPdf({
    senderBlock: [
      consumer.fullName,
      consumer.address1,
      `${consumer.city}, ${consumer.state} ${consumer.zip}`,
    ],
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    recipientBlock,
    subject: `Dispute of inaccurate information — account ${tradeline.accountRefMasked}`,
    body: drafted.bodyText,
    signatureName: consumer.fullName,
  });

  // 3. Persist the PDF in secure storage
  const pdfRef = await storage.put(
    `letters/${user.id}/${Date.now()}_${tradeline.id}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  // 4. Create the DisputeCase in DRAFT pointing at the secure letter ref
  const dc = await prisma.disputeCase.create({
    data: {
      userId: user.id,
      tradelineId: tradeline.id,
      letterType: body.letterType,
      aiReasonSummary: `${body.findingCode}: ${body.findingDetail}`,
      legalBasisSummary: drafted.legalBasis,
      status: "DRAFT",
      secureLetterRef: pdfRef,
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "DISPUTE_DRAFTED",
    entityType: "DisputeCase",
    entityId: dc.id,
    metadataJson: {
      letterType: body.letterType,
      pages: pdf.pages,
      aiLive: drafted.aiLive,
      pdfRef,
    },
  });

  return NextResponse.json({
    disputeCaseId: dc.id,
    pages: pdf.pages,
    legalBasis: drafted.legalBasis,
    aiLive: drafted.aiLive,
    bodyText: drafted.bodyText,
  });
}
