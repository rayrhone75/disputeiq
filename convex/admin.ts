// Admin destructive operations.
//
// Each mutation is audit-first: the auditLogs row is written *before* the
// destructive work begins, so the trail survives even if a child delete
// fails halfway through.
//
// Convex has no cascade deletes — children are deleted manually inside the
// same mutation. Order matters: we walk from leaves to root.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";
import type { Doc, Id } from "./_generated/dataModel";

// ─── Helpers ──────────────────────────────────────────────────────────────

const MIN_REASON_LENGTH = 10;

function assertReason(reason: string) {
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    throw new Error(`REASON_REQUIRED:${MIN_REASON_LENGTH}`);
  }
}

async function deleteImportChildren(
  ctx: { db: { query: any; delete: any } },
  importId: Id<"creditReportImports">,
) {
  const tables = [
    "creditReportRaws",
    "creditReportNormalized",
    "creditTradelines",
    "creditInquiries",
    "creditCollections",
    "creditPublicRecords",
    "creditScoreSnapshots",
    "creditPersonalProfiles",
    "creditDisputeCandidates",
  ] as const;

  for (const table of tables) {
    const indexName =
      table === "creditReportRaws" || table === "creditReportNormalized"
        ? "by_import"
        : table === "creditDisputeCandidates"
          ? "by_import_bureau"
          : "by_import_bureau";

    // For tables with by_import_bureau, we need to iterate without bureau
    const rows = await (ctx.db as any)
      .query(table)
      .withIndex(indexName, (q: any) => q.eq("importId", importId))
      .collect();
    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
  }
}

// ─── Impact previews ──────────────────────────────────────────────────────

export const previewImportImpact = query({
  args: { importId: v.id("creditReportImports") },
  handler: async (ctx, { importId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const imp = await ctx.db.get(importId);
    if (!imp) throw new Error("NOT_FOUND");

    const [
      tradelines,
      inquiries,
      collections,
      publicRecords,
      scoreSnapshots,
      personalProfiles,
      disputeCandidates,
    ] = await Promise.all([
      ctx.db
        .query("creditTradelines")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditInquiries")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditCollections")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditPublicRecords")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditScoreSnapshots")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditPersonalProfiles")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditDisputeCandidates")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
    ]);

    const owner = await ctx.db.get(imp.userId);

    return {
      import: {
        id: imp._id,
        provider: imp.provider,
        status: imp.status,
        createdAt: imp.createdAt,
      },
      user: owner ? { id: owner._id, email: owner.email } : null,
      rowsToRemove: {
        creditReportRaw: 1,
        creditReportNormalized: 1,
        creditTradelines: tradelines.length,
        creditInquiries: inquiries.length,
        creditCollections: collections.length,
        creditPublicRecords: publicRecords.length,
        creditScoreSnapshots: scoreSnapshots.length,
        creditPersonalProfiles: personalProfiles.length,
        creditDisputeCandidates: disputeCandidates.length,
      },
    };
  },
});

export const previewUserImpact = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("NOT_FOUND");

    const [
      reports,
      disputes,
      payments,
      creditImports,
      consentReceipts,
      auditLogsAsTarget,
      auditLogsAsActor,
      shadowStrikeRequests,
      supportNotes,
    ] = await Promise.all([
      ctx.db
        .query("creditReports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("disputeCases")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("paymentIntents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("creditReportImports")
        .withIndex("by_user_status", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("consentReceipts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("auditLogs")
        .withIndex("by_target", (q) => q.eq("targetUserId", userId))
        .collect(),
      ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorUserId", userId))
        .collect(),
      ctx.db
        .query("shadowStrikeRequests")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("supportNotes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    return {
      user: {
        id: u._id,
        email: u.email,
        role: u.role,
        archivedAt: u.archivedAt ?? null,
        createdAt: u.createdAt,
      },
      rowsToRemove: {
        creditReports: reports.length,
        disputes: disputes.length,
        payments: payments.length,
        creditReportImports: creditImports.length,
        consentReceipts: consentReceipts.length,
        auditLogsAsTarget: auditLogsAsTarget.length,
        auditLogsAsActor: auditLogsAsActor.length,
        shadowStrikeRequests: shadowStrikeRequests.length,
        supportNotes: supportNotes.length,
      },
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────

export const deleteImport = mutation({
  args: {
    importId: v.id("creditReportImports"),
    reason: v.string(),
  },
  handler: async (ctx, { importId, reason }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    assertReason(reason);

    const imp = await ctx.db.get(importId);
    if (!imp) throw new Error("NOT_FOUND");

    // Compute impact inline (queries-from-mutation-context disallowed).
    const [
      tradelines,
      inquiries,
      collections,
      publicRecords,
      scoreSnapshots,
      personalProfiles,
      disputeCandidates,
    ] = await Promise.all([
      ctx.db
        .query("creditTradelines")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditInquiries")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditCollections")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditPublicRecords")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditScoreSnapshots")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditPersonalProfiles")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
      ctx.db
        .query("creditDisputeCandidates")
        .withIndex("by_import_bureau", (q) => q.eq("importId", importId))
        .collect(),
    ]);
    const raws = await ctx.db
      .query("creditReportRaws")
      .withIndex("by_import", (q) => q.eq("importId", importId))
      .collect();
    const normalized = await ctx.db
      .query("creditReportNormalized")
      .withIndex("by_import", (q) => q.eq("importId", importId))
      .collect();

    const owner = await ctx.db.get(imp.userId);
    const impact = {
      creditReportRaw: raws.length,
      creditReportNormalized: normalized.length,
      creditTradelines: tradelines.length,
      creditInquiries: inquiries.length,
      creditCollections: collections.length,
      creditPublicRecords: publicRecords.length,
      creditScoreSnapshots: scoreSnapshots.length,
      creditPersonalProfiles: personalProfiles.length,
      creditDisputeCandidates: disputeCandidates.length,
    };

    const now = Date.now();

    // Audit FIRST.
    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: imp.userId,
      action: "CREDIT_IMPORT_DELETED",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: { reason, impact },
      createdAt: now,
    });

    // Then delete every child row, then the import itself.
    for (const r of raws) await ctx.db.delete(r._id);
    for (const r of normalized) await ctx.db.delete(r._id);
    for (const r of tradelines) await ctx.db.delete(r._id);
    for (const r of inquiries) await ctx.db.delete(r._id);
    for (const r of collections) await ctx.db.delete(r._id);
    for (const r of publicRecords) await ctx.db.delete(r._id);
    for (const r of scoreSnapshots) await ctx.db.delete(r._id);
    for (const r of personalProfiles) await ctx.db.delete(r._id);
    for (const r of disputeCandidates) await ctx.db.delete(r._id);
    await ctx.db.delete(importId);

    return {
      deleted: true,
      impact: {
        import: { id: importId, provider: imp.provider, status: imp.status },
        user: owner ? { id: owner._id, email: owner.email } : null,
        rowsToRemove: impact,
      },
    };
  },
});

export const deleteAllImportsForUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, { userId, reason }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    assertReason(reason);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("NOT_FOUND");

    const imports = await ctx.db
      .query("creditReportImports")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();
    if (imports.length === 0) {
      return {
        deleted: false,
        importCount: 0,
        user: { id: user._id, email: user.email },
      };
    }

    const importIds = imports.map((i) => i._id);
    const now = Date.now();

    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: userId,
      action: "CREDIT_IMPORTS_BULK_DELETED",
      entityType: "User",
      entityId: userId as unknown as string,
      metadataJson: {
        reason,
        importCount: imports.length,
        importIds: importIds.map((id) => id as unknown as string),
      },
      createdAt: now,
    });

    for (const importId of importIds) {
      const tables = [
        "creditTradelines",
        "creditInquiries",
        "creditCollections",
        "creditPublicRecords",
        "creditScoreSnapshots",
        "creditPersonalProfiles",
        "creditDisputeCandidates",
      ] as const;
      for (const t of tables) {
        const rows = await (ctx.db as any)
          .query(t)
          .withIndex("by_import_bureau", (q: any) => q.eq("importId", importId))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      const raws = await ctx.db
        .query("creditReportRaws")
        .withIndex("by_import", (q) => q.eq("importId", importId))
        .collect();
      for (const r of raws) await ctx.db.delete(r._id);
      const normalized = await ctx.db
        .query("creditReportNormalized")
        .withIndex("by_import", (q) => q.eq("importId", importId))
        .collect();
      for (const r of normalized) await ctx.db.delete(r._id);
      await ctx.db.delete(importId);
    }

    return {
      deleted: true,
      importCount: imports.length,
      user: { id: user._id, email: user.email },
    };
  },
});

export const archiveUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, { userId, reason }) => {
    const actor = await requireRole(ctx, ["OWNER", "ADMIN"]);
    assertReason(reason);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("NOT_FOUND");
    if (user.archivedAt) throw new Error("ALREADY_ARCHIVED");

    const archivedEmail = `archived+${user._id}@archive.disputeiq.internal`;
    const now = Date.now();

    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: userId,
      action: "USER_ARCHIVED",
      entityType: "User",
      entityId: userId as unknown as string,
      metadataJson: { reason, originalEmail: user.email },
      createdAt: now,
    });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, {
        fullName: "[redacted]",
        encryptedDob: "",
        encryptedSsnLast4: "",
        encryptedAddress1: "",
        encryptedCity: "",
        encryptedState: "",
        encryptedZip: "",
        encryptedPhone: undefined,
      });
    }

    await ctx.db.patch(userId, {
      email: archivedEmail,
      archivedAt: now,
      archivedReason: reason,
      archivedBy: actor._id,
      piiAnonymizedAt: now,
      updatedAt: now,
    });

    return { archived: true, user: { id: user._id, email: archivedEmail } };
  },
});

export const hardPurgeUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, { userId, reason }) => {
    const actor = await requireRole(ctx, ["OWNER"]);
    assertReason(reason);
    if (actor._id === userId) throw new Error("SELF_PURGE_FORBIDDEN");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("NOT_FOUND");

    // Compute impact inline.
    const [
      reports,
      disputes,
      payments,
      creditImports,
      consentReceipts,
      auditLogsAsTarget,
      auditLogsAsActor,
      shadowStrikeRequests,
      supportNotes,
      mailJobsByCase,
      profile,
      subscription,
    ] = await Promise.all([
      ctx.db
        .query("creditReports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("disputeCases")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("paymentIntents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("creditReportImports")
        .withIndex("by_user_status", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("consentReceipts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("auditLogs")
        .withIndex("by_target", (q) => q.eq("targetUserId", userId))
        .collect(),
      ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorUserId", userId))
        .collect(),
      ctx.db
        .query("shadowStrikeRequests")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("supportNotes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      Promise.resolve([] as Doc<"mailJobs">[]), // populated below per case
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db
        .query("userSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    ]);

    const impact = {
      creditReports: reports.length,
      disputes: disputes.length,
      payments: payments.length,
      creditReportImports: creditImports.length,
      consentReceipts: consentReceipts.length,
      auditLogsAsTarget: auditLogsAsTarget.length,
      auditLogsAsActor: auditLogsAsActor.length,
      shadowStrikeRequests: shadowStrikeRequests.length,
      supportNotes: supportNotes.length,
    };
    const now = Date.now();

    // Audit FIRST.
    await ctx.db.insert("auditLogs", {
      actorUserId: actor._id,
      targetUserId: userId,
      action: "USER_HARD_PURGED",
      entityType: "User",
      entityId: userId as unknown as string,
      metadataJson: {
        reason,
        impact,
        email: user.email,
        role: user.role,
      },
      createdAt: now,
    });

    // Null out audit log references so they remain queryable but orphaned.
    for (const row of auditLogsAsTarget) {
      await ctx.db.patch(row._id, { targetUserId: undefined });
    }
    for (const row of auditLogsAsActor) {
      await ctx.db.patch(row._id, { actorUserId: undefined });
    }

    // Walk legacy reports → tradelines.
    for (const report of reports) {
      const tls = await ctx.db
        .query("tradelines")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .collect();
      for (const tl of tls) await ctx.db.delete(tl._id);
      await ctx.db.delete(report._id);
    }

    // Walk dispute cases → mail jobs → events, and case attachments.
    for (const dc of disputes) {
      const jobs = await ctx.db
        .query("mailJobs")
        .withIndex("by_case", (q) => q.eq("disputeCaseId", dc._id))
        .collect();
      for (const job of jobs) {
        const events = await ctx.db
          .query("mailJobEvents")
          .withIndex("by_job", (q) => q.eq("mailJobId", job._id))
          .collect();
        for (const e of events) await ctx.db.delete(e._id);
        await ctx.db.delete(job._id);
      }
      const attachments = await ctx.db
        .query("caseAttachments")
        .withIndex("by_case", (q) => q.eq("disputeCaseId", dc._id))
        .collect();
      for (const a of attachments) await ctx.db.delete(a._id);
      await ctx.db.delete(dc._id);
    }

    for (const p of payments) await ctx.db.delete(p._id);
    for (const c of consentReceipts) await ctx.db.delete(c._id);
    for (const s of shadowStrikeRequests) await ctx.db.delete(s._id);
    for (const n of supportNotes) await ctx.db.delete(n._id);
    if (profile) await ctx.db.delete(profile._id);
    if (subscription) await ctx.db.delete(subscription._id);

    // Walk credit imports + cascade.
    for (const imp of creditImports) {
      const tables = [
        "creditTradelines",
        "creditInquiries",
        "creditCollections",
        "creditPublicRecords",
        "creditScoreSnapshots",
        "creditPersonalProfiles",
        "creditDisputeCandidates",
      ] as const;
      for (const t of tables) {
        const rows = await (ctx.db as any)
          .query(t)
          .withIndex("by_import_bureau", (q: any) => q.eq("importId", imp._id))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      const raws = await ctx.db
        .query("creditReportRaws")
        .withIndex("by_import", (q) => q.eq("importId", imp._id))
        .collect();
      for (const r of raws) await ctx.db.delete(r._id);
      const normalized = await ctx.db
        .query("creditReportNormalized")
        .withIndex("by_import", (q) => q.eq("importId", imp._id))
        .collect();
      for (const r of normalized) await ctx.db.delete(r._id);
      await ctx.db.delete(imp._id);
    }

    await ctx.db.delete(userId);

    return {
      purged: true,
      impact: {
        user: { id: user._id, email: user.email, role: user.role },
        rowsToRemove: impact,
      },
    };
  },
});

// ─── Misc admin queries ────────────────────────────────────────────────────

export const dashboardCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const [users, disputes, mailJobsAll, recentLogs] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("disputeCases").collect(),
      ctx.db.query("mailJobs").collect(),
      ctx.db.query("auditLogs").order("desc").take(8),
    ]);
    const inFlight = mailJobsAll.filter((j) =>
      ["QUEUED", "SUBMITTED", "MAILED"].includes(j.status),
    ).length;
    return {
      userCount: users.length,
      disputeCount: disputes.length,
      mailJobCount: inFlight,
      recentLogs,
    };
  },
});

/**
 * Customer console payload (support workspace).
 * Returns the user, their profile, subscription, recent imports/disputes/
 * payments, consents, and the most-recent audit trail.
 */
export const customerConsole = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const [
      profile,
      subscription,
      creditImports,
      disputes,
      payments,
      consentReceipts,
    ] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db
        .query("userSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db
        .query("creditReportImports")
        .withIndex("by_user_status", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20),
      ctx.db
        .query("disputeCases")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20),
      ctx.db
        .query("paymentIntents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
      ctx.db
        .query("consentReceipts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(5),
    ]);

    // Per-import counts (tradelines, collections, dispute candidates).
    const importsHydrated = await Promise.all(
      creditImports.map(async (imp) => {
        const [tls, cols, cands] = await Promise.all([
          ctx.db
            .query("creditTradelines")
            .withIndex("by_import_bureau", (q) => q.eq("importId", imp._id))
            .collect(),
          ctx.db
            .query("creditCollections")
            .withIndex("by_import_bureau", (q) => q.eq("importId", imp._id))
            .collect(),
          ctx.db
            .query("creditDisputeCandidates")
            .withIndex("by_import_bureau", (q) => q.eq("importId", imp._id))
            .collect(),
        ]);
        return {
          ...imp,
          _count: {
            tradelines: tls.length,
            collections: cols.length,
            disputeCandidates: cands.length,
          },
        };
      }),
    );

    return {
      user,
      profile,
      subscription,
      creditImports: importsHydrated,
      disputes,
      payments,
      consentReceipts,
    };
  },
});
