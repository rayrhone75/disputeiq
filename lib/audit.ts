import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  targetUserId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: (input.metadataJson ?? {}) as Prisma.InputJsonValue,
    },
  });
}
