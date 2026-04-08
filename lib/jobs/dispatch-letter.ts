import { prisma } from "@/lib/prisma";
import { sendLetterstreamJob, type LetterstreamRecipient, type LetterstreamSender } from "@/lib/letterstream";
import { writeAuditLog } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";

// Dispatches a paid dispute case as a real LetterStream mail job.
// Persists a MailJob row attached to the dispute case so admin/audit can see
// the provider job id, status, retries, and raw response.
export async function dispatchLetter(disputeCaseId: string) {
  const disputeCase = await prisma.disputeCase.findUniqueOrThrow({
    where: { id: disputeCaseId },
    include: {
      user: { include: { profile: true } },
      tradeline: true,
    },
  });
  if (!disputeCase.userConfirmedAt) throw new Error("User confirmation required before dispatch.");
  if (disputeCase.status !== "PAID") throw new Error("Letter must be paid before dispatch.");

  const profile = disputeCase.user.profile;
  if (!profile) throw new Error("User profile missing — cannot build sender address.");

  const securePdfRef = disputeCase.secureLetterRef ?? `secure://letters/${disputeCase.id}.pdf`;

  const sender: LetterstreamSender = {
    name: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  // Recipient is the bureau for a LetterType==="BUREAU_DISPUTE" letter, or the
  // furnisher/creditor for FCRA 623(b) letters. We default to the tradeline
  // creditor name and rely on LetterStream's address directory for the rest
  // when the row doesn't carry a full address.
  const recipient: LetterstreamRecipient = buildRecipient(disputeCase);

  const mailJob = await prisma.mailJob.create({
    data: {
      disputeCaseId: disputeCase.id,
      provider: "LETTERSTREAM",
      mode: (process.env.LETTERSTREAM_MODE ?? "test"),
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
      recipient,
      sender,
      certified: true,
      err: true,
      duplex: true,
      coversheet: false,
      color: false,
      returnEnvelope: false,
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
      submittedAt: succeeded ? new Date() : undefined,
      rawResponseJson: (result.rawResponse as any) ?? undefined,
      lastError: succeeded ? null : "submit returned non-success",
    },
  });

  await prisma.mailJobEvent.create({
    data: {
      mailJobId: mailJob.id,
      kind: succeeded ? "SUBMIT" : "ERROR",
      rawStatus: succeeded ? "submitted" : "submit_failed",
      mappedStatus: succeeded ? "SUBMITTED" : "FAILED",
      message: succeeded ? null : "submit returned non-success",
      payloadJson: (result.rawResponse as any) ?? undefined,
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

// Bureau PO boxes for classic consumer disputes. For furnisher (623(b))
// letters, we fall back to the tradeline creditor name — the actual address
// needs to be resolved upstream before this runs in production.
const BUREAU_ADDRESSES: Record<string, LetterstreamRecipient> = {
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address1: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374",
  },
  EXPERIAN: {
    name: "Experian",
    address1: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
  TRANSUNION: {
    name: "TransUnion LLC Consumer Dispute Center",
    address1: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016",
  },
};

function buildRecipient(disputeCase: any): LetterstreamRecipient {
  const bureau = (disputeCase.tradeline?.bureau ?? "").toUpperCase();
  if (BUREAU_ADDRESSES[bureau]) return BUREAU_ADDRESSES[bureau];
  return {
    name: disputeCase.tradeline?.creditorName ?? "Unknown Creditor",
    address1: "ADDRESS ON FILE",
    city: "UNKNOWN",
    state: "NA",
    zip: "00000",
  };
}
