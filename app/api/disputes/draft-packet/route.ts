import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { draftPacketLetter } from "@/lib/ai/draft-letter";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/audit";

// Packet draft endpoint.
// Input: bureau + a list of selected items (tradelineId + finding).
// Output: ONE DisputeCase, ONE PDF in secure storage, ready for one-shot
// LetterStream submission. Pricing remains a single flat action regardless of
// how many tradelines are inside.
const schema = z.object({
  bureau: z.enum(["EQUIFAX", "EXPERIAN", "TRANSUNION"]),
  letterType: z
    .enum(["FACTUAL_DISPUTE", "MOV_REQUEST", "DIRECT_FURNISHER", "IDENTITY_THEFT_605B"])
    .default("FACTUAL_DISPUTE"),
  items: z
    .array(
      z.object({
        tradelineId: z.string(),
        findingCode: z.string(),
        findingDetail: z.string(),
      }),
    )
    .min(1)
    .max(50),
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

  const tradelines = await prisma.tradeline.findMany({
    where: { id: { in: body.items.map((i) => i.tradelineId) } },
    include: { report: true },
  });
  if (tradelines.length !== body.items.length) {
    return NextResponse.json({ error: "TRADELINE_NOT_FOUND" }, { status: 404 });
  }
  for (const tl of tradelines) {
    if (tl.report.userId !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 400 });

  const consumer = {
    fullName: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  const recipientName = BUREAU_NAMES[body.bureau];
  const recipientBlock = [recipientName, ...BUREAU_ADDR[body.bureau]];

  const tlMap = new Map(tradelines.map((t) => [t.id, t]));
  const items = body.items.map((it) => {
    const tl = tlMap.get(it.tradelineId)!;
    return {
      creditor: tl.creditorName,
      accountRefMasked: tl.accountRefMasked,
      bureau: tl.bureau,
      balanceCents: tl.balanceCents,
      statusLabel: tl.statusLabel,
      findingCode: it.findingCode,
      findingDetail: it.findingDetail,
    };
  });

  const drafted = await draftPacketLetter({
    letterType: body.letterType,
    consumer,
    recipientName,
    items,
  });

  const pdf = buildLetterPdf({
    senderBlock: [
      consumer.fullName,
      consumer.address1,
      `${consumer.city}, ${consumer.state} ${consumer.zip}`,
    ],
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    recipientBlock,
    subject: `Dispute packet — ${items.length} account(s) reported by ${body.bureau}`,
    body: drafted.bodyText,
    signatureName: consumer.fullName,
  });

  const pdfRef = await storage.put(
    `letters/${user.id}/packet_${Date.now()}_${body.bureau}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  // One DisputeCase per packet. We attach the FIRST tradeline as the anchor;
  // the full list lives in the audit metadata and is regenerable from the body.
  const dc = await prisma.disputeCase.create({
    data: {
      userId: user.id,
      tradelineId: tradelines[0].id,
      letterType: body.letterType,
      aiReasonSummary: `Packet to ${body.bureau} covering ${items.length} item(s).`,
      legalBasisSummary: drafted.legalBasis,
      status: "DRAFT",
      secureLetterRef: pdfRef,
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "DISPUTE_PACKET_DRAFTED",
    entityType: "DisputeCase",
    entityId: dc.id,
    metadataJson: {
      bureau: body.bureau,
      letterType: body.letterType,
      itemCount: items.length,
      tradelineIds: tradelines.map((t) => t.id),
      pages: pdf.pages,
      aiLive: drafted.aiLive,
      pdfRef,
    },
  });

  return NextResponse.json({
    disputeCaseId: dc.id,
    bureau: body.bureau,
    items: items.length,
    pages: pdf.pages,
    legalBasis: drafted.legalBasis,
    aiLive: drafted.aiLive,
    bodyText: drafted.bodyText,
  });
}
