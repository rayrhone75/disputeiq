// Centralized job handler registration. Imported by any route that enqueues
// work so handlers are guaranteed to be present in the running process.
import { registerHandler } from "@/lib/queue";
import { dispatchLetter } from "@/lib/jobs/dispatch-letter";

let registered = false;

export function ensureJobHandlers() {
  if (registered) return;
  registerHandler<{ disputeCaseId: string }>("dispatch-letter", async ({ disputeCaseId }) => {
    await dispatchLetter(disputeCaseId);
  });
  registered = true;
}
