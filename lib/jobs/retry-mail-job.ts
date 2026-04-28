// Manual, admin-only retry for a failed mail job.
//
// The state-prep work (retry event row, audit log, status flip) lives in
// `api.mailJobs.prepareRetry`, which authenticates the actor via Clerk
// identity. The actual re-dispatch (which contacts LetterStream) is then
// run from this Next.js helper using the dispatcher in `dispatch-letter.ts`.
//
// Policy:
//   - Only mail jobs in FAILED state can be retried (enforced inside the
//     Convex mutation).
//   - Every retry writes a RETRY MailJobEvent + AuditLog entry with the
//     actor.
//   - The retry triggers a fresh dispatch which creates a new MailJob row
//     attached to the same dispute case — by design, so each submission
//     attempt is traceable.

import { fetchMutation } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dispatchLetter } from "@/lib/jobs/dispatch-letter";

export async function retryMailJob(params: {
  mailJobId: Id<"mailJobs">;
}) {
  const { mailJobId } = params;

  // Forward the caller's Clerk token so the mutation can read the actor's
  // role (must be OWNER/ADMIN) and identity for the audit log.
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("UNAUTHENTICATED");

  const { disputeCaseId } = await fetchMutation(
    api.mailJobs.prepareRetry,
    { mailJobId },
    { token },
  );

  // Re-run the dispatcher. This creates a new MailJob row attached to the
  // same dispute case for traceability.
  return dispatchLetter(disputeCaseId);
}
