import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCompliantAction } from "@/lib/compliance";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  userId: z.string(),
  tradelineId: z.string().optional(),
  letterType: z.enum(["FACTUAL_DISPUTE", "MOV_REQUEST", "DIRECT_FURNISHER", "IDENTITY_THEFT_605B", "CFPB_PACKET"]),
  aiReasonSummary: z.string().min(1),
  legalBasisSummary: z.string().optional(),
  disclosuresAccepted: z.boolean(),
  affiliateDisclosureAccepted: z.boolean(),
  userConfirmed: z.boolean(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  assertCompliantAction(body);

  const dc = await prisma.disputeCase.create({
    data: {
      userId: body.userId,
      tradelineId: body.tradelineId,
      letterType: body.letterType,
      aiReasonSummary: body.aiReasonSummary,
      legalBasisSummary: body.legalBasisSummary,
      status: "NEEDS_USER_CONFIRMATION",
      userConfirmedAt: new Date(),
    },
  });

  await writeAuditLog({
    targetUserId: body.userId,
    action: "DISPUTE_CREATED",
    entityType: "DisputeCase",
    entityId: dc.id,
    metadataJson: { letterType: body.letterType },
  });

  return NextResponse.json({ disputeCaseId: dc.id });
}
