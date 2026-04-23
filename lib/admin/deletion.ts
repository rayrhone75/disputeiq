// Admin deletion toolkit.
//
// Three destructive operations with escalating blast radius:
//
//   1. deleteImport(importId)
//        Removes a single CreditReportImport + all its cascaded children
//        (raw, normalized, tradelines, inquiries, collections, public
//        records, scores, personal profiles, dispute candidates).
//        Leaves the user untouched.
//
//   2. deleteAllImportsForUser(userId)
//        Removes every CreditReportImport owned by that user and all
//        cascaded children. Leaves the user, their legacy CreditReport
//        rows, and their disputes intact.
//
//   3. archiveUser(userId, reason)
//        Soft delete: clears PII from UserProfile and renames the email to
//        a non-routable archived form so the row still satisfies its unique
//        constraint. Audit log stays intact. Reversible in principle by
//        support if the data is restored from backup; not reversible
//        automatically.
//
//   4. hardPurgeUser(userId, reason)
//        Destructive, unrecoverable. Deletes the user row and all
//        cascaded relations. Only OWNER may invoke. Requires typed
//        confirmation + non-empty reason at the route layer.
//
// Every operation writes the impact snapshot to the audit log *before*
// deleting, so we have a trail even if the cascade fails mid-transaction.

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const MIN_REASON_LENGTH = 10;

export class DeletionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeletionError";
  }
}

function assertReason(reason: string) {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new DeletionError(
      "REASON_REQUIRED",
      `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
    );
  }
}

// ─── Impact previews ────────────────────────────────────────────────────────

export async function previewImportImpact(importId: string) {
  const imp = await prisma.creditReportImport.findUnique({
    where: { id: importId },
    include: {
      user: { select: { id: true, email: true } },
      _count: {
        select: {
          tradelines: true,
          inquiries: true,
          collections: true,
          publicRecords: true,
          scoreSnapshots: true,
          personalProfiles: true,
          disputeCandidates: true,
        },
      },
    },
  });
  if (!imp) throw new DeletionError("NOT_FOUND", "Import not found.");
  return {
    import: {
      id: imp.id,
      provider: imp.provider,
      status: imp.status,
      createdAt: imp.createdAt,
    },
    user: imp.user,
    rowsToRemove: {
      creditReportRaw: 1,
      creditReportNormalized: 1,
      creditTradelines: imp._count.tradelines,
      creditInquiries: imp._count.inquiries,
      creditCollections: imp._count.collections,
      creditPublicRecords: imp._count.publicRecords,
      creditScoreSnapshots: imp._count.scoreSnapshots,
      creditPersonalProfiles: imp._count.personalProfiles,
      creditDisputeCandidates: imp._count.disputeCandidates,
    },
  };
}

export async function previewUserImpact(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      archivedAt: true,
      _count: {
        select: {
          reports: true,
          disputes: true,
          payments: true,
          creditImports: true,
          consentReceipts: true,
          auditLogs: true,
          actorLogs: true,
          shadowStrikeRequests: true,
          supportNotes: true,
        },
      },
    },
  });
  if (!user) throw new DeletionError("NOT_FOUND", "User not found.");
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      archivedAt: user.archivedAt,
      createdAt: user.createdAt,
    },
    rowsToRemove: {
      creditReports: user._count.reports,
      disputes: user._count.disputes,
      payments: user._count.payments,
      creditReportImports: user._count.creditImports,
      consentReceipts: user._count.consentReceipts,
      auditLogsAsTarget: user._count.auditLogs,
      auditLogsAsActor: user._count.actorLogs,
      shadowStrikeRequests: user._count.shadowStrikeRequests,
      supportNotes: user._count.supportNotes,
    },
  };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function deleteImport(opts: {
  importId: string;
  reason: string;
  actorUserId: string;
}) {
  assertReason(opts.reason);
  const impact = await previewImportImpact(opts.importId);

  // Audit first, delete second.
  await writeAuditLog({
    actorUserId: opts.actorUserId,
    targetUserId: impact.user.id,
    action: "CREDIT_IMPORT_DELETED",
    entityType: "CreditReportImport",
    entityId: opts.importId,
    metadataJson: {
      reason: opts.reason,
      impact: impact.rowsToRemove as unknown as Record<string, number>,
    },
  });

  await prisma.$transaction(async (tx) => {
    // Cascades defined in schema.prisma handle child rows.
    await tx.creditReportImport.delete({ where: { id: opts.importId } });
  });

  return { deleted: true, impact };
}

export async function deleteAllImportsForUser(opts: {
  userId: string;
  reason: string;
  actorUserId: string;
}) {
  assertReason(opts.reason);
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, email: true },
  });
  if (!user) throw new DeletionError("NOT_FOUND", "User not found.");

  const imports = await prisma.creditReportImport.findMany({
    where: { userId: opts.userId },
    select: { id: true },
  });
  if (!imports.length) {
    return { deleted: false, importCount: 0, user };
  }

  await writeAuditLog({
    actorUserId: opts.actorUserId,
    targetUserId: opts.userId,
    action: "CREDIT_IMPORTS_BULK_DELETED",
    entityType: "User",
    entityId: opts.userId,
    metadataJson: {
      reason: opts.reason,
      importCount: imports.length,
      importIds: imports.map((i) => i.id),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.creditReportImport.deleteMany({
      where: { id: { in: imports.map((i) => i.id) } },
    });
  });

  return { deleted: true, importCount: imports.length, user };
}

/**
 * Soft delete: clear PII, rename the email to a non-routable form, and mark
 * the user archived. Audit history stays intact.
 */
export async function archiveUser(opts: {
  userId: string;
  reason: string;
  actorUserId: string;
}) {
  assertReason(opts.reason);
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, email: true, archivedAt: true, profile: { select: { id: true } } },
  });
  if (!user) throw new DeletionError("NOT_FOUND", "User not found.");
  if (user.archivedAt) throw new DeletionError("ALREADY_ARCHIVED", "User is already archived.");

  // Non-routable archived email preserves the unique constraint while
  // making it obvious in admin views that this is a tombstone.
  const archivedEmail = `archived+${user.id}@archive.disputeiq.internal`;

  await writeAuditLog({
    actorUserId: opts.actorUserId,
    targetUserId: opts.userId,
    action: "USER_ARCHIVED",
    entityType: "User",
    entityId: opts.userId,
    metadataJson: { reason: opts.reason, originalEmail: user.email },
  });

  await prisma.$transaction(async (tx) => {
    if (user.profile) {
      await tx.userProfile.update({
        where: { userId: opts.userId },
        data: {
          fullName: "[redacted]",
          encryptedDob: "",
          encryptedSsnLast4: "",
          encryptedAddress1: "",
          encryptedCity: "",
          encryptedState: "",
          encryptedZip: "",
          encryptedPhone: null,
        },
      });
    }
    await tx.user.update({
      where: { id: opts.userId },
      data: {
        email: archivedEmail,
        archivedAt: new Date(),
        archivedReason: opts.reason,
        archivedBy: opts.actorUserId,
        piiAnonymizedAt: new Date(),
        passwordHash: null,
      },
    });
  });

  return { archived: true, user: { id: user.id, email: archivedEmail } };
}

/**
 * Privileged hard purge — removes the user row and all cascades. Callers MUST
 * additionally enforce role gating (OWNER) and typed-confirmation at the
 * route layer; this function only checks that a reason is present.
 */
export async function hardPurgeUser(opts: {
  userId: string;
  reason: string;
  actorUserId: string;
  actorRole: string;
}) {
  assertReason(opts.reason);
  if (opts.actorRole !== "OWNER") {
    throw new DeletionError("FORBIDDEN", "Only OWNER may hard-purge a user.");
  }
  if (opts.userId === opts.actorUserId) {
    throw new DeletionError("SELF_PURGE_FORBIDDEN", "You cannot hard-purge your own account.");
  }

  const impact = await previewUserImpact(opts.userId);

  // Audit first so the trail survives the delete.
  await writeAuditLog({
    actorUserId: opts.actorUserId,
    targetUserId: opts.userId,
    action: "USER_HARD_PURGED",
    entityType: "User",
    entityId: opts.userId,
    metadataJson: {
      reason: opts.reason,
      impact: impact.rowsToRemove as unknown as Record<string, number>,
      email: impact.user.email,
      role: impact.user.role,
    },
  });

  // AuditLog rows referencing this user become orphaned (actor/target set
  // null by Prisma's default behavior on SetNull relations). We explicitly
  // null them here to make the outcome deterministic across DB drivers.
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.updateMany({
      where: { targetUserId: opts.userId },
      data: { targetUserId: null },
    });
    await tx.auditLog.updateMany({
      where: { actorUserId: opts.userId },
      data: { actorUserId: null },
    });
    await tx.user.delete({ where: { id: opts.userId } });
  });

  return { purged: true, impact };
}

// ─── Helpers for route layer ───────────────────────────────────────────────

export function expectedImportConfirmation(importId: string): string {
  return `DELETE IMPORT ${importId.slice(0, 8)}`;
}

export function expectedUserConfirmation(email: string): string {
  return `DELETE ${email}`;
}

export function expectedPurgeConfirmation(email: string): string {
  return `PURGE ${email}`;
}

export type DeletionInput = {
  reason: string;
  confirmation: string;
  actorUserId: string;
};

export function isConfirmationOk(actual: string, expected: string) {
  return actual.trim() === expected.trim();
}

// Kept for backwards type compat in case callers import it.
export type PrismaTx = Prisma.TransactionClient;
