import { prisma } from "@/lib/prisma";
import type { ShadowStrikeProvider } from "@prisma/client";

export async function queueShadowStrike(input: {
  userId: string;
  provider: ShadowStrikeProvider;
  userConfirmed: boolean;
}) {
  if (!input.userConfirmed) throw new Error("User confirmation required.");
  return prisma.shadowStrikeRequest.create({
    data: { userId: input.userId, provider: input.provider, status: "QUEUED" },
  });
}
