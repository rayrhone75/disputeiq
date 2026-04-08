import { prisma } from "@/lib/prisma";

export async function create605BCase(input: {
  userId: string;
  tradelineId: string;
  identityTheftReportRef: string;
  photoIdRef: string;
  aiReasonSummary: string;
}) {
  return prisma.disputeCase.create({
    data: {
      userId: input.userId,
      tradelineId: input.tradelineId,
      letterType: "IDENTITY_THEFT_605B",
      status: "NEEDS_USER_CONFIRMATION",
      aiReasonSummary: input.aiReasonSummary,
      legalBasisSummary: "FCRA 605B identity theft block request",
      attachments: {
        create: [
          { kind: "IDENTITY_THEFT_REPORT", secureFileRef: input.identityTheftReportRef },
          { kind: "PHOTO_ID", secureFileRef: input.photoIdRef },
        ],
      },
    },
  });
}
