// User-facing status mapping for LetterStream mail jobs.
//
// The internal `MailJobStatus` enum (QUEUED/SUBMITTED/ACCEPTED/PRINTED/MAILED/
// DELIVERED/FAILED) is the provider state machine — too granular for the
// dashboard. `toUserFacingStatus` collapses it into a 5-step user journey
// (queued → mailed → in_transit → delivered → signed) plus a failure state.
//
// The MailJobStatus type is duplicated here from `convex/schema.ts` rather
// than imported from `@prisma/client` (which is gone). It must stay in sync
// with the `mailJobStatus` v.union in the schema.

export type MailJobStatus =
  | "QUEUED"
  | "SUBMITTED"
  | "ACCEPTED"
  | "PRINTED"
  | "MAILED"
  | "DELIVERED"
  | "FAILED";

/**
 * User-facing status buckets.
 * Provider statuses (MailJobStatus) are internal; this is what the UI shows.
 */
export type UserFacingStatus =
  | "queued"
  | "mailed"
  | "in_transit"
  | "delivered"
  | "signed"
  | "failed";

export function toUserFacingStatus(
  providerStatus: MailJobStatus,
  opts?: { signedAt?: number | null },
): UserFacingStatus {
  if (opts?.signedAt) return "signed";
  switch (providerStatus) {
    case "QUEUED":
    case "SUBMITTED":
    case "ACCEPTED":
      return "queued";
    case "PRINTED":
      return "mailed";
    case "MAILED":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "FAILED":
      return "failed";
    default:
      return "queued";
  }
}

export const STATUS_LABELS: Record<UserFacingStatus, string> = {
  queued: "Queued",
  mailed: "Mailed",
  in_transit: "In transit",
  delivered: "Delivered",
  signed: "Signed",
  failed: "Failed",
};

export const STATUS_ORDER: UserFacingStatus[] = [
  "queued",
  "mailed",
  "in_transit",
  "delivered",
  "signed",
];

/**
 * Parse a raw LetterStream tracking event string into an event kind
 * suitable for the MailJobEvent.kind column.
 */
export function classifyEventKind(raw?: string): "STATUS" | "SCAN" | "SIGNATURE" | "ERROR" {
  if (!raw) return "STATUS";
  const s = raw.toLowerCase();
  if (s.includes("sign")) return "SIGNATURE";
  if (s.includes("scan") || s.includes("in transit") || s.includes("processing")) return "SCAN";
  if (s.includes("fail") || s.includes("error") || s.includes("return")) return "ERROR";
  return "STATUS";
}
