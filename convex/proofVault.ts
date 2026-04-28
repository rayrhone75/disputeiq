// Convex functions for the dashboard proof-vault page.
//
// Returns the current user's case attachments joined with their dispute case
// + tradeline + AI verdict (when present in auditLogs.metadataJson). The
// page renders this directly via fetchQuery from the server component.

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./helpers";

export type VaultAttachment = {
  id: Id<"caseAttachments">;
  disputeCaseId: Id<"disputeCases">;
  kind: string;
  secureFileRef: string;
  createdAt: number;
  creditor: string;
  bureau: string;
  status: string;
  classification?: string;
  recommendation?: string;
  reasoning?: string;
};

/**
 * Returns every attachment owned by the current user, joined with case +
 * tradeline + AI-verdict metadata sourced from the audit log.
 */
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<VaultAttachment[]> => {
    const user = await requireUser(ctx);

    // Find the user's dispute cases first (indexed). For each, pull
    // attachments via the by_case index.
    const cases = await ctx.db
      .query("disputeCases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cases.length === 0) return [];

    const caseById = new Map(cases.map((c) => [c._id, c] as const));

    const attachmentLists = await Promise.all(
      cases.map((c) =>
        ctx.db
          .query("caseAttachments")
          .withIndex("by_case", (q) => q.eq("disputeCaseId", c._id))
          .collect(),
      ),
    );
    const attachments = attachmentLists.flat();

    // Pull AI-verdict audit log rows for these cases. We only care about
    // rows whose metadataJson carries an `attachmentId` and a classification.
    const verdictByAttachmentId = new Map<
      string,
      { classification?: string; recommendation?: string; reasoning?: string }
    >();

    for (const c of cases) {
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "DisputeCase").eq("entityId", c._id),
        )
        .collect();
      for (const log of logs) {
        if (log.action !== "BUREAU_RESPONSE_UPLOADED") continue;
        const m = (log.metadataJson ?? {}) as Record<string, unknown>;
        const attachmentId =
          typeof m.attachmentId === "string" ? m.attachmentId : undefined;
        if (!attachmentId) continue;
        verdictByAttachmentId.set(attachmentId, {
          classification:
            typeof m.classification === "string" ? m.classification : undefined,
          recommendation:
            typeof m.recommendation === "string" ? m.recommendation : undefined,
          reasoning:
            typeof m.reasoning === "string" ? m.reasoning : undefined,
        });
      }
    }

    // Attachment list — needs the tradeline for creditor/bureau columns.
    const out: VaultAttachment[] = [];
    for (const a of attachments) {
      const dc = caseById.get(a.disputeCaseId);
      if (!dc) continue;
      const tradeline = dc.tradelineId ? await ctx.db.get(dc.tradelineId) : null;
      const verdict = verdictByAttachmentId.get(a._id) ?? {};
      out.push({
        id: a._id,
        disputeCaseId: a.disputeCaseId,
        kind: a.kind,
        secureFileRef: a.secureFileRef,
        createdAt: a.createdAt,
        creditor: tradeline?.creditorName ?? "Bureau packet",
        bureau: tradeline?.bureau ?? "—",
        status: dc.status,
        ...verdict,
      });
    }

    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

/**
 * Resolves an attachment id for the current user, returning the storage
 * reference + filename hints. Used by `/api/proof-vault/download` to issue
 * a signed URL or stream the file.
 *
 * Throws FORBIDDEN if the attachment doesn't belong to the user.
 */
export const getAttachmentForCurrentUser = query({
  args: { attachmentId: v.id("caseAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const user = await requireUser(ctx);

    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) return null;

    const disputeCase = await ctx.db.get(attachment.disputeCaseId);
    if (!disputeCase || disputeCase.userId !== user._id) {
      throw new Error("FORBIDDEN");
    }

    return {
      id: attachment._id,
      kind: attachment.kind,
      secureFileRef: attachment.secureFileRef,
      disputeCaseId: attachment.disputeCaseId,
    };
  },
});
