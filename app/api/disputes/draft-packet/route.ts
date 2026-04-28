import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { draftPacketLetter } from "@/lib/ai/draft-letter";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/encryption";

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
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const tradelineIds = body.items.map((i) => i.tradelineId as Id<"tradelines">);
  const tradelines = await fetchQuery(
    api.disputes.tradelinesForUser,
    { tradelineIds },
    { token },
  );
  if (!tradelines) {
    return NextResponse.json({ error: "TRADELINE_NOT_FOUND" }, { status: 404 });
  }

  const profile = await fetchQuery(api.disputes.userProfileForLetter, {}, { token });
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

  const tlMap = new Map(tradelines.map((t) => [t._id as unknown as string, t]));
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
    `letters/${userId}/packet_${Date.now()}_${body.bureau}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  // One DisputeCase per packet. We attach the FIRST tradeline as the anchor;
  // the full list lives in the audit metadata and is regenerable from the body.
  const disputeCaseId = (await fetchMutation(
    api.disputes.createDraft,
    {
      tradelineId: tradelines[0]._id,
      letterType: body.letterType,
      aiReasonSummary: `Packet to ${body.bureau} covering ${items.length} item(s).`,
      legalBasisSummary: drafted.legalBasis,
      secureLetterRef: pdfRef,
      auditAction: "DISPUTE_PACKET_DRAFTED",
      auditMetadata: {
        bureau: body.bureau,
        letterType: body.letterType,
        itemCount: items.length,
        tradelineIds: tradelines.map((t) => t._id),
        pages: pdf.pages,
        aiLive: drafted.aiLive,
        pdfRef,
      },
    },
    { token },
  )) as Id<"disputeCases">;

  return NextResponse.json({
    disputeCaseId,
    bureau: body.bureau,
    items: items.length,
    pages: pdf.pages,
    legalBasis: drafted.legalBasis,
    aiLive: drafted.aiLive,
    bodyText: drafted.bodyText,
  });
}
