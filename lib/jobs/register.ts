// Centralized job handler registration. Imported by any route that enqueues
// work so handlers are guaranteed to be present in the running process.
import { registerHandler } from "@/lib/queue";
import { dispatchLetter } from "@/lib/jobs/dispatch-letter";
import type { Id } from "@/convex/_generated/dataModel";

let registered = false;

export function ensureJobHandlers() {
  if (registered) return;
  registerHandler<{ disputeCaseId: string }>("dispatch-letter", async ({ disputeCaseId }) => {
    // Job payloads ride the queue as plain strings; Convex expects branded ids.
    await dispatchLetter(disputeCaseId as Id<"disputeCases">);
  });
  registered = true;
}
