import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// Builds a CFPB complaint packet record. The user reviews and submits to CFPB themselves.
const schema = z.object({
  userId: z.string(),
  tradelineId: z.string().optional(),
  narrative: z.string().min(20),
  userConfirmed: z.literal(true),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const dc = await prisma.disputeCase.create({
    data: {
      userId: body.userId,
      tradelineId: body.tradelineId,
      letterType: "CFPB_PACKET",
      status: "NEEDS_USER_CONFIRMATION",
      aiReasonSummary: body.narrative.slice(0, 500),
      legalBasisSummary: "CFPB consumer complaint packet — user submits themselves.",
    },
  });

  await writeAuditLog({
    targetUserId: body.userId,
    action: "CFPB_PACKET_CREATED",
    entityType: "DisputeCase",
    entityId: dc.id,
    metadataJson: {},
  });

  return NextResponse.json({ disputeCaseId: dc.id });
}
