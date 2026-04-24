// Freeze module — tracks user-consented secondary-bureau freeze requests.
// Reuses the existing ShadowStrikeRequest table (LexisNexis, Innovis, SageStream)
// since those are the same providers and the schema already supports
// status + confirmation tracking.
//
// IMPORTANT: This is real state tracking, not fake automation. There is no
// public consumer API for these freezes. We record the user's intent, the
// state of each request, and surface deep-links/instructions in the UI.
// When a confirmation is received we update the row to "completed".

import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type FreezeProvider = "LEXISNEXIS" | "INNOVIS" | "SAGESTREAM";

export const FREEZE_PROVIDERS: FreezeProvider[] = [
  "LEXISNEXIS",
  "INNOVIS",
  "SAGESTREAM",
];

export type FreezeStatus = "pending" | "completed" | "failed";

async function tokenOrNull() {
  const { getToken } = await auth();
  return await getToken({ template: "convex" });
}

export async function queueFreezesForUser(source: string) {
  const token = await tokenOrNull();
  if (!token) return [];
  const result = (await fetchMutation(
    api.onboarding.queueFreezesForUser,
    { source },
    { token },
  )) as { created: string[] };
  return result.created;
}

export async function listFreezesForUser(): Promise<Doc<"shadowStrikeRequests">[]> {
  const token = await tokenOrNull();
  if (!token) return [];
  return (await fetchQuery(api.onboarding.listFreezes, {}, { token })) as Doc<
    "shadowStrikeRequests"
  >[];
}

export async function setFreezeStatus(input: {
  id: Id<"shadowStrikeRequests"> | string;
  status: FreezeStatus;
  confirmationRef?: string;
  lastError?: string;
}) {
  const token = await tokenOrNull();
  if (!token) throw new Error("UNAUTHENTICATED");
  return await fetchMutation(
    api.onboarding.setFreezeStatus,
    {
      id: input.id as Id<"shadowStrikeRequests">,
      status: input.status,
      confirmationRef: input.confirmationRef,
      lastError: input.lastError,
    },
    { token },
  );
}
