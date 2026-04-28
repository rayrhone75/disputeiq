// Convex functions for the legacy CreditReport + Tradeline tables.
//
// These predate the credit-import pipeline (creditReportImports/...). They
// continue to back the dashboard "Reports" page so users with pre-pipeline
// uploads keep their data. Going forward most new imports flow through
// `creditReportImports` instead.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";
import type { Doc } from "./_generated/dataModel";

const reportSource = v.union(
  v.literal("MANUAL_UPLOAD"),
  v.literal("MYFREESCORENOW"),
  v.literal("IDENTITYIQ"),
  v.literal("MYSCOREIQ"),
);

// ── Queries ────────────────────────────────────────────────────────────

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const reports = await ctx.db
      .query("creditReports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    reports.sort((a, b) => b.pulledAt - a.pulledAt);
    const hydrated = await Promise.all(
      reports.map(async (r) => {
        const tradelines = await ctx.db
          .query("tradelines")
          .withIndex("by_report", (q) => q.eq("reportId", r._id))
          .collect();
        return { ...r, tradelines };
      }),
    );
    return hydrated;
  },
});

export const countForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const reports = await ctx.db
      .query("creditReports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return reports.length;
  },
});

export const latestIdiqClickForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_target", (q) => q.eq("targetUserId", user._id))
      .collect();
    const filtered = rows.filter((r) => r.action === "IDIQ_CLICK");
    if (filtered.length === 0) return null;
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return { createdAt: filtered[0].createdAt };
  },
});

export const getOwnedReport = query({
  args: { id: v.id("creditReports") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const report = await ctx.db.get(id);
    if (!report) return null;
    if (report.userId !== user._id && user.role === "USER") return null;
    const tradelines = await ctx.db
      .query("tradelines")
      .withIndex("by_report", (q) => q.eq("reportId", id))
      .collect();
    return { ...report, tradelines };
  },
});

export const adminList = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const reports = await ctx.db.query("creditReports").collect();
    reports.sort((a, b) => b.pulledAt - a.pulledAt);
    const page = reports.slice(0, limit ?? 50);
    const reportIds = page.map((r) => r._id);

    const allLogs = await ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("entityType"), "CreditReport"))
      .collect();
    const logsByReport = new Map<string, typeof allLogs>();
    for (const l of allLogs) {
      if (!reportIds.some((id) => id === l.entityId)) continue;
      const arr = logsByReport.get(l.entityId) ?? [];
      arr.push(l);
      logsByReport.set(l.entityId, arr);
    }

    const hydrated = await Promise.all(
      page.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const tradelines = await ctx.db
          .query("tradelines")
          .withIndex("by_report", (q) => q.eq("reportId", r._id))
          .collect();
        return {
          ...r,
          user: user ? { email: user.email } : { email: "" },
          tradelines: tradelines.map((t) => ({ id: t._id })),
          logs: logsByReport.get(r._id) ?? [],
        };
      }),
    );
    return hydrated;
  },
});

// ── Mutations ──────────────────────────────────────────────────────────

export const createReport = mutation({
  args: {
    source: reportSource,
    snapshotHash: v.string(),
    rawSecureRef: v.optional(v.string()),
    pulledAtMs: v.optional(v.number()),
    tradelines: v.array(
      v.object({
        bureau: v.string(),
        creditorName: v.string(),
        accountRefMasked: v.string(),
        balanceCents: v.optional(v.number()),
        pastDueCents: v.optional(v.number()),
        statusLabel: v.optional(v.string()),
        openedAtMs: v.optional(v.number()),
        lastReportedAtMs: v.optional(v.number()),
        lastActivityAtMs: v.optional(v.number()),
        isCollection: v.optional(v.boolean()),
        isMedical: v.optional(v.boolean()),
      }),
    ),
    auditAction: v.string(),
    auditMetadataJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const reportId = await ctx.db.insert("creditReports", {
      userId: me._id,
      source: args.source,
      pulledAt: args.pulledAtMs ?? now,
      snapshotHash: args.snapshotHash,
      rawSecureRef: args.rawSecureRef,
    });
    for (const t of args.tradelines) {
      await ctx.db.insert("tradelines", {
        reportId,
        bureau: t.bureau,
        creditorName: t.creditorName,
        accountRefMasked: t.accountRefMasked,
        balanceCents: t.balanceCents,
        pastDueCents: t.pastDueCents,
        statusLabel: t.statusLabel,
        openedAt: t.openedAtMs,
        lastReportedAt: t.lastReportedAtMs,
        lastActivityAt: t.lastActivityAtMs,
        isCollection: t.isCollection ?? false,
        isMedical: t.isMedical ?? false,
        isFraudClaimed: false,
      });
    }
    await ctx.db.insert("auditLogs", {
      targetUserId: me._id,
      actorUserId: me._id,
      action: args.auditAction,
      entityType: "CreditReport",
      entityId: reportId,
      metadataJson: args.auditMetadataJson ?? {},
      createdAt: now,
    });
    return { id: reportId };
  },
});

export const deleteReport = mutation({
  args: { id: v.id("creditReports") },
  handler: async (ctx, { id }) => {
    const me = await requireUser(ctx);
    const report = await ctx.db.get(id);
    if (!report) throw new Error("NOT_FOUND");
    if (report.userId !== me._id && me.role === "USER") {
      throw new Error("FORBIDDEN");
    }
    const tradelines = await ctx.db
      .query("tradelines")
      .withIndex("by_report", (q) => q.eq("reportId", id))
      .collect();
    for (const t of tradelines) await ctx.db.delete(t._id);
    await ctx.db.delete(id);
    await ctx.db.insert("auditLogs", {
      targetUserId: report.userId,
      actorUserId: me._id,
      action: "REPORT_DELETED",
      entityType: "CreditReport",
      entityId: id,
      metadataJson: { tradelineCount: tradelines.length, source: report.source },
      createdAt: Date.now(),
    });
    return { ok: true, deletedTradelines: tradelines.length };
  },
});

export const writeReportAnalyzedAudit = mutation({
  args: {
    reportId: v.id("creditReports"),
    findings: v.number(),
    aiLive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("NOT_FOUND");
    if (report.userId !== me._id && me.role === "USER") {
      throw new Error("FORBIDDEN");
    }
    await ctx.db.insert("auditLogs", {
      targetUserId: report.userId,
      actorUserId: me._id,
      action: "REPORT_ANALYZED",
      entityType: "CreditReport",
      entityId: args.reportId,
      metadataJson: { findings: args.findings, aiLive: args.aiLive },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Unused helper kept in case callers need a typed result.
export type CreditReportRow = Doc<"creditReports"> & {
  tradelines: Doc<"tradelines">[];
};
