// Dispatcher for paid dispute cases — sends a real LetterStream certified
// mail packet, persists the MailJob row + events, and advances the dispute
// case to MAILED on success.
//
// All DB I/O goes through `fetchQuery`/`fetchMutation` against the functions
// in `convex/mailJobs.ts`. Those functions are gated by an
// `INTERNAL_SERVICE_SECRET` env var rather than a Clerk token, because the
// dispatcher runs from background contexts (queue handler, square webhook
// callback) that don't carry a user session. `getDispatchBundle` does the
// user/profile/tradeline join server-side and returns a plain object.

import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  sendLetterstreamJob,
  type LetterstreamRecipient,
  type LetterstreamSender,
} from "@/lib/letterstream";
import { decrypt } from "@/lib/encryption";
import { queueFreezesForUser } from "@/lib/freeze";

function internalSecret(): string {
  const s = process.env.INTERNAL_SERVICE_SECRET;
  if (!s) throw new Error("INTERNAL_SERVICE_SECRET env var is required to run server jobs.");
  return s;
}

export async function dispatchLetter(disputeCaseId: Id<"disputeCases">) {
  const secret = internalSecret();

  const bundle = await fetchQuery(api.mailJobs.getDispatchBundle, {
    secret,
    disputeCaseId,
  });
  if (!bundle) throw new Error(`Dispute case ${disputeCaseId} not found.`);

  const { disputeCase, owner, profile, tradeline } = bundle;
  if (!owner) throw new Error("Dispute case owner missing.");
  if (!disputeCase.userConfirmedAt) {
    throw new Error("User confirmation required before dispatch.");
  }
  if (disputeCase.status !== "PAID") {
    throw new Error("Letter must be paid before dispatch.");
  }
  if (!profile) {
    throw new Error("User profile missing — cannot build sender address.");
  }

  const securePdfRef =
    disputeCase.secureLetterRef ?? `secure://letters/${disputeCase._id}.pdf`;

  const sender: LetterstreamSender = {
    name: profile.fullName,
    address1: decrypt(profile.encryptedAddress1),
    city: decrypt(profile.encryptedCity),
    state: decrypt(profile.encryptedState),
    zip: decrypt(profile.encryptedZip),
  };

  const recipient: LetterstreamRecipient = buildRecipient(tradeline);

  // Create the QUEUED row first so we have an audit anchor regardless of
  // what happens during the LetterStream submit.
  const mailJobId = await fetchMutation(api.mailJobs.createQueued, {
    secret,
    disputeCaseId: disputeCase._id,
    mode: process.env.LETTERSTREAM_MODE ?? "test",
    certified: true,
    err: true,
    attempts: 1,
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
      metadata: { disputeCaseId: disputeCase._id, mailJobId },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await fetchMutation(api.mailJobs.patchAfterSubmit, {
      secret,
      mailJobId,
      status: "FAILED",
      lastError: errMsg,
    });
    await fetchMutation(api.mailJobs.writeAuditLog, {
      secret,
      targetUserId: disputeCase.userId,
      action: "LETTER_DISPATCH_FAILED",
      entityType: "disputeCases",
      entityId: disputeCase._id,
      metadataJson: { mailJobId, error: errMsg },
    });
    throw e;
  }

  const succeeded = result.status === "submitted";
  await fetchMutation(api.mailJobs.patchAfterSubmit, {
    secret,
    mailJobId,
    status: succeeded ? "SUBMITTED" : "FAILED",
    providerJobId: result.jobId,
    submittedAt: succeeded ? Date.now() : undefined,
    rawResponseJson: (result.rawResponse as unknown) ?? undefined,
    lastError: succeeded ? null : "submit returned non-success",
  });

  await fetchMutation(api.mailJobs.appendEvent, {
    secret,
    mailJobId,
    kind: succeeded ? "SUBMIT" : "ERROR",
    rawStatus: succeeded ? "submitted" : "submit_failed",
    mappedStatus: succeeded ? "SUBMITTED" : "FAILED",
    message: succeeded ? null : "submit returned non-success",
    payloadJson: (result.rawResponse as unknown) ?? undefined,
  });

  if (succeeded) {
    await fetchMutation(api.mailJobs.patchDisputeStatus, {
      secret,
      disputeCaseId: disputeCase._id,
      status: "MAILED",
      mailedAt: Date.now(),
    });
    // Auto-queue secondary freeze requests once a packet has been mailed.
    // Idempotent: skips providers the user already has a pending request with.
    // NOTE: the new freeze helper derives the user from the Clerk session,
    // so we just pass a `source` string. Since this dispatcher runs from
    // background contexts that may not carry a Clerk token, the call is
    // best-effort and silently no-ops without a session.
    await queueFreezesForUser(`dispatch:${disputeCase._id}`).catch(() => null);
  }

  await fetchMutation(api.mailJobs.writeAuditLog, {
    secret,
    targetUserId: disputeCase.userId,
    action: succeeded ? "LETTER_DISPATCHED" : "LETTER_DISPATCH_FAILED",
    entityType: "disputeCases",
    entityId: disputeCase._id,
    metadataJson: {
      mailJobId,
      providerJobId: result.jobId,
      mode: result.mode,
    },
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

type TradelineLite = {
  bureau?: string | null;
  creditorName?: string | null;
} | null;

function buildRecipient(tradeline: TradelineLite): LetterstreamRecipient {
  const bureau = (tradeline?.bureau ?? "").toUpperCase();
  if (BUREAU_ADDRESSES[bureau]) return BUREAU_ADDRESSES[bureau];
  return {
    name: tradeline?.creditorName ?? "Unknown Creditor",
    address1: "ADDRESS ON FILE",
    city: "UNKNOWN",
    state: "NA",
    zip: "00000",
  };
}
