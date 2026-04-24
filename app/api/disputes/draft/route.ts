import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { draftLetter } from "@/lib/ai/draft-letter";
import { buildLetterPdf } from "@/lib/letter-pdf";
import { storage } from "@/lib/storage";
import { decrypt } from "@/lib/encryption";

const schema = z.object({
  tradelineId: z.string(),
  letterType: z.enum([
    "FACTUAL_DISPUTE",
    "MOV_REQUEST",
    "DIRECT_FURNISHER",
    "IDENTITY_THEFT_605B",
  ]),
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
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const tradelineId = body.tradelineId as Id<"tradelines">;
  const tlBundle = await fetchQuery(
    api.disputes.tradelineForUser,
    { tradelineId },
    { token },
  );
  if (!tlBundle) {
    return NextResponse.json({ error: "TRADELINE_NOT_FOUND" }, { status: 404 });
  }
  const tradeline = tlBundle.tradeline;

  const profile = await fetchQuery(
    api.disputes.userProfileForLetter,
    {},
    { token },
  );
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
    `letters/${userId}/${Date.now()}_${tradelineId}.pdf`,
    pdf.bytes,
    "application/pdf",
  );

  // 4. Create the DisputeCase in DRAFT pointing at the secure letter ref.
  //    Audit log is written inside the same Convex mutation.
  const disputeCaseId = (await fetchMutation(
    api.disputes.createDraft,
    {
      tradelineId,
      letterType: body.letterType,
      aiReasonSummary: `${body.findingCode}: ${body.findingDetail}`,
      legalBasisSummary: drafted.legalBasis,
      secureLetterRef: pdfRef,
      auditAction: "DISPUTE_DRAFTED",
      auditMetadata: {
        letterType: body.letterType,
        pages: pdf.pages,
        aiLive: drafted.aiLive,
        pdfRef,
      },
    },
    { token },
  )) as Id<"disputeCases">;

  return NextResponse.json({
    disputeCaseId,
    pages: pdf.pages,
    legalBasis: drafted.legalBasis,
    aiLive: drafted.aiLive,
    bodyText: drafted.bodyText,
  });
}
