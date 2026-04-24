// Server-side helper to promote an identity-theft (FCRA §605B) case from
// the AI flow + uploaded evidence. Persists a NEEDS_USER_CONFIRMATION
// dispute case in Convex and attaches the FTC identity-theft report + photo
// ID via `caseAttachments.createMany`.
//
// The Clerk JWT must already be available — pass the Convex token through
// from the calling Next.js route.

import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface Create605BInput {
  /** Convex token (Clerk-issued) for the calling user. */
  token: string;
  tradelineId: Id<"tradelines">;
  identityTheftReportRef: string;
  photoIdRef: string;
  aiReasonSummary: string;
}

export async function create605BCase(input: Create605BInput) {
  const disputeCaseId = (await fetchMutation(
    api.disputes.createForConfirmation,
    {
      tradelineId: input.tradelineId,
      letterType: "IDENTITY_THEFT_605B",
      aiReasonSummary: input.aiReasonSummary,
      legalBasisSummary: "FCRA 605B identity theft block request",
    },
    { token: input.token },
  )) as Id<"disputeCases">;

  await fetchMutation(
    api.caseAttachments.createMany,
    {
      disputeCaseId,
      items: [
        { kind: "IDENTITY_THEFT_REPORT", secureFileRef: input.identityTheftReportRef },
        { kind: "PHOTO_ID", secureFileRef: input.photoIdRef },
      ],
    },
    { token: input.token },
  );

  return { disputeCaseId };
}
