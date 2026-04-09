// Freeze module — tracks user-consented secondary-bureau freeze requests.
// Reuses the existing ShadowStrikeRequest table (LexisNexis, Innovis, SageStream)
// since those are the same providers and the schema already supports
// status + confirmation tracking.
//
// IMPORTANT: This is real state tracking, not fake automation. There is no
// public consumer API for these freezes. We record the user's intent, the
// state of each request, and surface deep-links/instructions in the UI.
// When a confirmation is received we update the row to "completed".
import { prisma } from "@/lib/prisma";
import type { ShadowStrikeProvider } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

export const FREEZE_PROVIDERS: ShadowStrikeProvider[] = [
  "LEXISNEXIS",
  "INNOVIS",
  "SAGESTREAM",
];

export type FreezeStatus = "pending" | "completed" | "failed";

export async function queueFreezesForUser(userId: string, source: string) {
  const created = [];
  for (const provider of FREEZE_PROVIDERS) {
    const existing = await prisma.shadowStrikeRequest.findFirst({
      where: { userId, provider, status: { in: ["pending", "QUEUED", "SUBMITTED"] } },
    });
    if (existing) continue;
    const row = await prisma.shadowStrikeRequest.create({
      data: { userId, provider, status: "pending" },
    });
    created.push(row);
    await writeAuditLog({
      targetUserId: userId,
      action: "FREEZE_QUEUED",
      entityType: "ShadowStrikeRequest",
      entityId: row.id,
      metadataJson: { provider, source },
    }).catch(() => null);
  }
  return created;
}

export async function listFreezesForUser(userId: string) {
  return prisma.shadowStrikeRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function setFreezeStatus(input: {
  id: string;
  userId: string;
  status: FreezeStatus;
  confirmationRef?: string;
  lastError?: string;
}) {
  const row = await prisma.shadowStrikeRequest.findUnique({ where: { id: input.id } });
  if (!row || row.userId !== input.userId) throw new Error("FORBIDDEN");
  const updated = await prisma.shadowStrikeRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      confirmationRef: input.confirmationRef ?? row.confirmationRef,
      lastError: input.lastError ?? row.lastError,
      submittedAt: input.status === "completed" ? new Date() : row.submittedAt,
    },
  });
  await writeAuditLog({
    targetUserId: input.userId,
    action: "FREEZE_STATUS",
    entityType: "ShadowStrikeRequest",
    entityId: input.id,
    metadataJson: { status: input.status, confirmationRef: input.confirmationRef },
  }).catch(() => null);
  return updated;
}
