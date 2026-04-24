import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { writeAuditLog } from "@/lib/audit";

// Builds a CFPB complaint packet record. The user reviews and submits to CFPB themselves.
const schema = z.object({
  tradelineId: z.string().optional(),
  narrative: z.string().min(20),
  userConfirmed: z.literal(true),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const disputeCaseId = (await fetchMutation(
    api.disputes.createForConfirmation,
    {
      tradelineId: body.tradelineId
        ? (body.tradelineId as Id<"tradelines">)
        : undefined,
      letterType: "CFPB_PACKET",
      aiReasonSummary: body.narrative.slice(0, 500),
      legalBasisSummary:
        "CFPB consumer complaint packet — user submits themselves.",
    },
    { token },
  )) as Id<"disputeCases">;

  await writeAuditLog({
    action: "CFPB_PACKET_CREATED",
    entityType: "DisputeCase",
    entityId: disputeCaseId as unknown as string,
    metadataJson: {},
  }).catch(() => null);

  return NextResponse.json({ disputeCaseId });
}
