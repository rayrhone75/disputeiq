import { prisma } from "@/lib/prisma";
import { sendLetterstreamJob } from "@/lib/letterstream";
import { writeAuditLog } from "@/lib/audit";

// Dispatches a paid dispute case as a real LetterStream mail job.
// Persists a MailJob row attached to the dispute case so admin/audit can see
// the provider job id, status, retries, and raw response.
export async function dispatchLetter(disputeCaseId: string) {
  const disputeCase = await prisma.disputeCase.findUniqueOrThrow({ where: { id: disputeCaseId } });
  if (!disputeCase.userConfirmedAt) throw new Error("User confirmation required before dispatch.");
  if (disputeCase.status !== "PAID") throw new Error("Letter must be paid before dispatch.");

  const securePdfRef = disputeCase.secureLetterRef ?? `secure://letters/${disputeCase.id}.pdf`;

  const mailJob = await prisma.mailJob.create({
    data: {
      disputeCaseId: disputeCase.id,
      provider: "LETTERSTREAM",
      mode: process.env.LETTERSTREAM_MODE ?? "test",
      certified: true,
      err: true,
      status: "QUEUED",
      attempts: 1,
    },
  });

  let result;
  try {
    result = await sendLetterstreamJob({
      securePdfRef,
      certified: true,
      err: true,
      metadata: { disputeCaseId: disputeCase.id, mailJobId: mailJob.id },
    });
  } catch (e: any) {
    await prisma.mailJob.update({
      where: { id: mailJob.id },
      data: { status: "FAILED", lastError: String(e?.message ?? e) },
    });
    await writeAuditLog({
      targetUserId: disputeCase.userId,
      action: "LETTER_DISPATCH_FAILED",
      entityType: "DisputeCase",
      entityId: disputeCase.id,
      metadataJson: { mailJobId: mailJob.id, error: String(e?.message ?? e) },
    });
    throw e;
  }

  const succeeded = result.status === "submitted";
  await prisma.mailJob.update({
    where: { id: mailJob.id },
    data: {
      providerJobId: result.jobId,
      status: succeeded ? "SUBMITTED" : "FAILED",
      rawResponseJson: (result.rawResponse as any) ?? undefined,
      lastError: succeeded ? null : "submit returned non-success",
    },
  });

  if (succeeded) {
    await prisma.disputeCase.update({
      where: { id: disputeCase.id },
      data: { status: "MAILED", mailedAt: new Date() },
    });
  }

  await writeAuditLog({
    targetUserId: disputeCase.userId,
    action: succeeded ? "LETTER_DISPATCHED" : "LETTER_DISPATCH_FAILED",
    entityType: "DisputeCase",
    entityId: disputeCase.id,
    metadataJson: { mailJobId: mailJob.id, providerJobId: result.jobId, mode: result.mode },
  });

  return result;
}
