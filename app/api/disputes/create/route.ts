import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { assertCompliantAction } from "@/lib/compliance";

const schema = z.object({
  // userId is no longer used — server resolves the caller from the Clerk
  // token. Kept optional for legacy callers; ignored.
  userId: z.string().optional(),
  tradelineId: z.string().optional(),
  letterType: z.enum([
    "FACTUAL_DISPUTE",
    "MOV_REQUEST",
    "DIRECT_FURNISHER",
    "IDENTITY_THEFT_605B",
    "CFPB_PACKET",
  ]),
  aiReasonSummary: z.string().min(1),
  legalBasisSummary: z.string().optional(),
  disclosuresAccepted: z.boolean(),
  affiliateDisclosureAccepted: z.boolean(),
  userConfirmed: z.boolean(),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  assertCompliantAction(body);

  const disputeCaseId = (await fetchMutation(
    api.disputes.createForConfirmation,
    {
      tradelineId: body.tradelineId
        ? (body.tradelineId as Id<"tradelines">)
        : undefined,
      letterType: body.letterType,
      aiReasonSummary: body.aiReasonSummary,
      legalBasisSummary: body.legalBasisSummary,
    },
    { token },
  )) as Id<"disputeCases">;

  return NextResponse.json({ disputeCaseId });
}
