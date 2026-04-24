// Convex functions for the `caseAttachments` table.
//
// Attachments hold uploaded artifacts tied to a dispute case (e.g. the
// bureau's response letter PDF, the FTC identity-theft report, photo IDs
// for 605B blocks). The blob itself lives in secure object storage; this
// table just stores the secure ref + a kind tag.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

/**
 * Insert a new attachment. Verifies the dispute case belongs to the caller.
 * Optionally writes an `auditLogs` row in the same mutation (set when the
 * caller is recording user-visible activity such as a bureau-response upload).
 */
export const create = mutation({
  args: {
    disputeCaseId: v.id("disputeCases"),
    kind: v.string(),
    secureFileRef: v.string(),
    auditAction: v.optional(v.string()),
    auditMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(args.disputeCaseId);
    if (!dc || dc.userId !== user._id) throw new Error("NOT_FOUND");
    const now = Date.now();
    const attachmentId = await ctx.db.insert("caseAttachments", {
      disputeCaseId: args.disputeCaseId,
      kind: args.kind,
      secureFileRef: args.secureFileRef,
      createdAt: now,
    });
    if (args.auditAction) {
      await ctx.db.insert("auditLogs", {
        targetUserId: user._id,
        actorUserId: user._id,
        action: args.auditAction,
        entityType: "disputeCases",
        entityId: args.disputeCaseId as unknown as string,
        metadataJson: {
          ...(args.auditMetadata ?? {}),
          attachmentId,
          kind: args.kind,
          secureFileRef: args.secureFileRef,
        },
        createdAt: now,
      });
    }
    return attachmentId;
  },
});

/**
 * Bulk-create variant — used when promoting an identity-theft (605B) case
 * with both the FTC report and a photo ID at once.
 */
export const createMany = mutation({
  args: {
    disputeCaseId: v.id("disputeCases"),
    items: v.array(
      v.object({
        kind: v.string(),
        secureFileRef: v.string(),
      }),
    ),
  },
  handler: async (ctx, { disputeCaseId, items }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(disputeCaseId);
    if (!dc || dc.userId !== user._id) throw new Error("NOT_FOUND");
    const now = Date.now();
    const ids = await Promise.all(
      items.map((it) =>
        ctx.db.insert("caseAttachments", {
          disputeCaseId,
          kind: it.kind,
          secureFileRef: it.secureFileRef,
          createdAt: now,
        }),
      ),
    );
    return ids;
  },
});

/**
 * List attachments for a single dispute case. Ownership-checked.
 */
export const listForCase = query({
  args: { disputeCaseId: v.id("disputeCases") },
  handler: async (ctx, { disputeCaseId }) => {
    const user = await requireUser(ctx);
    const dc = await ctx.db.get(disputeCaseId);
    if (!dc || dc.userId !== user._id) return [];
    return await ctx.db
      .query("caseAttachments")
      .withIndex("by_case", (q) => q.eq("disputeCaseId", disputeCaseId))
      .collect();
  },
});
