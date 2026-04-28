// Admin deletion toolkit (Next.js wrappers around the Convex `admin.*`
// mutations). Convex enforces audit-first + role gating; this module
// provides typed-confirmation helpers used by the admin UI to show
// the literal phrase the operator must type.

export class DeletionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeletionError";
  }
}

const MIN_REASON_LENGTH = 10;

export function assertReason(reason: string) {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new DeletionError(
      "REASON_REQUIRED",
      `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
    );
  }
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
  actorUserId?: string;
};

export function isConfirmationOk(actual: string, expected: string) {
  return actual.trim() === expected.trim();
}
