// Audit log writer (Next.js layer).
//
// Forwards to the Convex `auditLogs.write` mutation. The actor is derived
// from the calling Clerk identity inside the mutation, so callers don't
// pass `actorUserId` here. `targetUserId` is optional and must be a
// Convex `Id<"users">` if provided.

import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function writeAuditLog(input: {
  /** Convex users._id of the affected user. */
  targetUserId?: Id<"users"> | string;
  /** Convex users._id of the actor — IGNORED here; the mutation reads it
   * from the Clerk token. Kept in the type for legacy call-site compat. */
  actorUserId?: Id<"users"> | string;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson?: Record<string, unknown>;
}) {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (token) {
      return await fetchMutation(
        api.auditLogs.write,
        {
          targetUserId: input.targetUserId
            ? (input.targetUserId as Id<"users">)
            : undefined,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadataJson: input.metadataJson ?? {},
        },
        { token },
      );
    }
    // No Clerk token (public route, e.g. webhook). Use the system writer.
    const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
    if (!secret) return null;
    return await fetchMutation(api.auditLogs.writeSystem, {
      secret,
      targetUserId: input.targetUserId
        ? (input.targetUserId as Id<"users">)
        : undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: input.metadataJson ?? {},
    });
  } catch {
    // Never throw from audit logging — every caller chains `.catch(() => null)`
    // anyway, but defensively swallow here too.
    return null;
  }
}
