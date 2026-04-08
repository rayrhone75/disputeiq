import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { dispatchLetter } from "@/lib/jobs/dispatch-letter";

/**
 * Manual, admin-only retry for a failed mail job.
 *
 * Policy (Phase B, per product direction):
 *   - Only mail jobs in FAILED state can be retried.
 *   - Jobs already SUBMITTED / ACCEPTED / PRINTED / MAILED / DELIVERED are
 *     locked — retrying those would double-mail at real cost.
 *   - Every retry writes a RETRY MailJobEvent + AuditLog entry with the actor.
 *
 * Callers (admin route handlers) must already have authenticated + authorized
 * the actor as ADMIN/OWNER before calling this.
 */
export async function retryMailJob(params: {
  mailJobId: string;
  actorUserId: string;
}) {
  const { mailJobId, actorUserId } = params;

  const mailJob = await prisma.mailJob.findUniqueOrThrow({
    where: { id: mailJobId },
    include: { disputeCase: true },
  });

  if (mailJob.status !== "FAILED") {
    throw new Error(
      `Mail job ${mailJobId} is in status ${mailJob.status}. Only FAILED jobs can be retried.`,
    );
  }

  await prisma.mailJobEvent.create({
    data: {
      mailJobId: mailJob.id,
      kind: "RETRY",
      rawStatus: "manual_retry",
      message: `Manual retry initiated by admin ${actorUserId}`,
    },
  });

  await writeAuditLog({
    actorUserId,
    targetUserId: mailJob.disputeCase.userId,
    action: "MAIL_JOB_RETRY",
    entityType: "MailJob",
    entityId: mailJob.id,
    metadataJson: { previousAttempts: mailJob.attempts, lastError: mailJob.lastError },
  }).catch(() => null);

  await prisma.mailJob.update({
    where: { id: mailJob.id },
    data: { status: "QUEUED", attempts: { increment: 1 }, lastError: null },
  });

  // Re-run the dispatcher. It will create a second MailJob row attached to the
  // same dispute case — by design, so each submission attempt is traceable.
  return dispatchLetter(mailJob.disputeCaseId);
}
