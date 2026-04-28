// Onboarding state derivation + the consolidated dashboard payload.
//
// The dashboard root page calls `dashboardOverview` which returns
// everything the page needs in a single round-trip — reports, tradelines,
// disputes, mail jobs, freezes, packet usage, subscription, onboarding
// state, and a derived credit-report status summary.
//
// This module also owns the freeze (shadow-strike) workflow because it
// is part of the onboarding/dashboard surface.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";
import type { Doc } from "./_generated/dataModel";

// ─── Onboarding ───────────────────────────────────────────────────────────

export type OnboardingStep =
  | "profile"
  | "subscription"
  | "report_connect"
  | "report_pending"
  | "ready";

export const state = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const [profile, subscription, reports, tradelinesAcrossReports] =
      await Promise.all([
        ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique(),
        ctx.db
          .query("userSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique(),
        ctx.db
          .query("creditReports")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect(),
        // tradelines join through report ownership
        (async () => {
          const reports = await ctx.db
            .query("creditReports")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
          if (reports.length === 0) return [] as Doc<"tradelines">[];
          const tlGroups = await Promise.all(
            reports.map((r) =>
              ctx.db
                .query("tradelines")
                .withIndex("by_report", (q) => q.eq("reportId", r._id))
                .collect(),
            ),
          );
          return tlGroups.flat();
        })(),
      ]);

    const hasProfile = !!profile;
    const hasSubscription = !!subscription && subscription.status === "active";
    const subscriptionStatus = subscription?.status ?? null;
    const reportCount = reports.length;
    const tradelineCount = tradelinesAcrossReports.length;

    let step: OnboardingStep;
    if (!hasProfile) step = "profile";
    else if (!hasSubscription) step = "subscription";
    else if (reportCount === 0) step = "report_connect";
    else if (tradelineCount === 0) step = "report_pending";
    else step = "ready";

    return {
      step,
      hasProfile,
      hasSubscription,
      subscriptionStatus,
      reportCount,
      tradelineCount,
    };
  },
});

// ─── Dashboard overview (consolidated) ────────────────────────────────────

export const dashboardOverview = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const [reports, disputes, freezes, subscription, latestImport, recentTargetLogs] =
      await Promise.all([
        ctx.db
          .query("creditReports")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .collect(),
        ctx.db
          .query("disputeCases")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .collect(),
        ctx.db
          .query("shadowStrikeRequests")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .collect(),
        ctx.db
          .query("userSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique(),
        ctx.db
          .query("creditReportImports")
          .withIndex("by_user_status", (q) => q.eq("userId", user._id))
          .order("desc")
          .first(),
        ctx.db
          .query("auditLogs")
          .withIndex("by_target", (q) => q.eq("targetUserId", user._id))
          .order("desc")
          .take(100),
      ]);
    const idiqClickAt =
      recentTargetLogs.find((l) => l.action === "IDIQ_CLICK")?.createdAt ?? null;

    // Hydrate tradelines per report.
    const reportsWithTradelines = await Promise.all(
      reports.map(async (r) => {
        const tls = await ctx.db
          .query("tradelines")
          .withIndex("by_report", (q) => q.eq("reportId", r._id))
          .collect();
        return { ...r, tradelines: tls };
      }),
    );
    const tradelines = reportsWithTradelines.flatMap((r) => r.tradelines);

    // Hydrate dispute tradelines.
    const tradelineIds = Array.from(
      new Set(disputes.map((d) => d.tradelineId).filter(Boolean)),
    );
    const tlMap = new Map<string, Doc<"tradelines"> | null>();
    for (const tlId of tradelineIds) {
      const tl = tlId ? await ctx.db.get(tlId) : null;
      tlMap.set(tlId as unknown as string, tl);
    }
    const disputesHydrated = disputes.map((d) => ({
      ...d,
      tradeline: d.tradelineId
        ? tlMap.get(d.tradelineId as unknown as string) ?? null
        : null,
    }));

    // Mail jobs across all of the user's dispute cases.
    const mailJobsRaw = await Promise.all(
      disputes.map((d) =>
        ctx.db
          .query("mailJobs")
          .withIndex("by_case", (q) => q.eq("disputeCaseId", d._id))
          .order("desc")
          .collect(),
      ),
    );
    const mailJobs = mailJobsRaw
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt);

    // Packet usage.
    let packetUsage = {
      plan: null as string | null,
      included: 0,
      used: 0,
      remaining: 0,
      cycleStart: null as number | null,
      cycleEnd: null as number | null,
      overagePriceCents: 1995,
    };
    if (subscription && subscription.status === "active") {
      const counted = disputes.filter(
        (c) =>
          ["PAID", "MAILED", "DELIVERED", "RESPONSE_RECEIVED", "CLOSED"].includes(
            c.status,
          ) &&
          c.mailedAt != null &&
          c.mailedAt >= subscription.cycleStart,
      );
      const used = counted.length;
      packetUsage = {
        plan: subscription.planCode,
        included: subscription.includedPackets,
        used,
        remaining: Math.max(0, subscription.includedPackets - used),
        cycleStart: subscription.cycleStart,
        cycleEnd: subscription.cycleEnd,
        overagePriceCents: subscription.overagePacketPriceCents,
      };
    }

    // Credit-report status (port of lib/credit-import/status.ts).
    const creditReportStatus = deriveCreditReportStatus({
      latestImport: latestImport
        ? {
            id: latestImport._id as unknown as string,
            status: latestImport.status,
            createdAt: latestImport.createdAt,
            updatedAt: latestImport.updatedAt,
            normalizedAt: latestImport.normalizedAt ?? null,
          }
        : null,
      legacyReportCount: reports.length,
      idiqClickAt,
    });

    // Onboarding step.
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const hasProfile = !!profile;
    const hasSubscription =
      !!subscription && subscription.status === "active";
    let step: OnboardingStep;
    if (!hasProfile) step = "profile";
    else if (!hasSubscription) step = "subscription";
    else if (reports.length === 0) step = "report_connect";
    else if (tradelines.length === 0) step = "report_pending";
    else step = "ready";

    return {
      reports: reportsWithTradelines,
      tradelines,
      disputes: disputesHydrated,
      mailJobs,
      freezes,
      subscription,
      packetUsage,
      creditReportStatus,
      onboarding: {
        step,
        hasProfile,
        hasSubscription,
        subscriptionStatus: subscription?.status ?? null,
        reportCount: reports.length,
        tradelineCount: tradelines.length,
      },
      user: {
        id: user._id,
        email: user.email,
        isGraceUser: user.isGraceUser,
      },
    };
  },
});

// ─── Pure derivation (mirrors lib/credit-import/status.ts) ────────────────

type CreditReportStatusKind =
  | "not_started"
  | "in_progress"
  | "imported"
  | "failed";

type DerivedStatus = {
  kind: CreditReportStatusKind;
  latestImportId: string | null;
  latestImportStatus: string | null;
  legacyReportCount: number;
  hasClickedIdiq: boolean;
  lastUpdatedAt: number | null;
};

function deriveCreditReportStatus(inputs: {
  latestImport: {
    id: string;
    status: string;
    createdAt: number;
    updatedAt: number;
    normalizedAt: number | null;
  } | null;
  legacyReportCount: number;
  idiqClickAt: number | null;
}): DerivedStatus {
  const { latestImport, legacyReportCount, idiqClickAt } = inputs;

  if (latestImport && latestImport.status !== "ARCHIVED") {
    const lastUpdatedAt =
      latestImport.normalizedAt ?? latestImport.updatedAt ?? latestImport.createdAt;
    if (latestImport.status === "NORMALIZED") {
      return {
        kind: "imported",
        latestImportId: latestImport.id,
        latestImportStatus: latestImport.status,
        legacyReportCount,
        hasClickedIdiq: !!idiqClickAt,
        lastUpdatedAt,
      };
    }
    if (latestImport.status === "FAILED") {
      return {
        kind: "failed",
        latestImportId: latestImport.id,
        latestImportStatus: latestImport.status,
        legacyReportCount,
        hasClickedIdiq: !!idiqClickAt,
        lastUpdatedAt,
      };
    }
    return {
      kind: "in_progress",
      latestImportId: latestImport.id,
      latestImportStatus: latestImport.status,
      legacyReportCount,
      hasClickedIdiq: !!idiqClickAt,
      lastUpdatedAt,
    };
  }

  if (legacyReportCount > 0) {
    return {
      kind: "imported",
      latestImportId: null,
      latestImportStatus: null,
      legacyReportCount,
      hasClickedIdiq: !!idiqClickAt,
      lastUpdatedAt: null,
    };
  }

  if (idiqClickAt) {
    return {
      kind: "in_progress",
      latestImportId: null,
      latestImportStatus: null,
      legacyReportCount,
      hasClickedIdiq: true,
      lastUpdatedAt: idiqClickAt,
    };
  }

  return {
    kind: "not_started",
    latestImportId: null,
    latestImportStatus: null,
    legacyReportCount,
    hasClickedIdiq: false,
    lastUpdatedAt: null,
  };
}

// ─── Freeze / shadow-strike workflow ───────────────────────────────────────

const FREEZE_PROVIDER = v.union(
  v.literal("LEXISNEXIS"),
  v.literal("INNOVIS"),
  v.literal("SAGESTREAM"),
);

export const listFreezes = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("shadowStrikeRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const queueFreezesForUser = mutation({
  args: { source: v.string() },
  handler: async (ctx, { source }) => {
    const user = await requireUser(ctx);
    const providers = ["LEXISNEXIS", "INNOVIS", "SAGESTREAM"] as const;
    const existing = await ctx.db
      .query("shadowStrikeRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const created: string[] = [];
    const now = Date.now();
    for (const provider of providers) {
      const inFlight = existing.find(
        (e) =>
          e.provider === provider &&
          ["pending", "QUEUED", "SUBMITTED"].includes(e.status),
      );
      if (inFlight) continue;
      const id = await ctx.db.insert("shadowStrikeRequests", {
        userId: user._id,
        provider,
        status: "pending",
        createdAt: now,
      });
      created.push(id as unknown as string);
      await ctx.db.insert("auditLogs", {
        actorUserId: user._id,
        targetUserId: user._id,
        action: "FREEZE_QUEUED",
        entityType: "ShadowStrikeRequest",
        entityId: id as unknown as string,
        metadataJson: { provider, source },
        createdAt: now,
      });
    }
    return { created };
  },
});

export const setFreezeStatus = mutation({
  args: {
    id: v.id("shadowStrikeRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    confirmationRef: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== user._id) throw new Error("FORBIDDEN");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      confirmationRef: args.confirmationRef ?? row.confirmationRef,
      lastError: args.lastError ?? row.lastError,
      submittedAt: args.status === "completed" ? now : row.submittedAt,
    });
    await ctx.db.insert("auditLogs", {
      actorUserId: user._id,
      targetUserId: user._id,
      action: "FREEZE_STATUS",
      entityType: "ShadowStrikeRequest",
      entityId: args.id as unknown as string,
      metadataJson: {
        status: args.status,
        confirmationRef: args.confirmationRef ?? null,
      },
      createdAt: now,
    });
    return { ok: true };
  },
});

export const queueShadowStrike = mutation({
  args: { provider: FREEZE_PROVIDER },
  handler: async (ctx, { provider }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("shadowStrikeRequests", {
      userId: user._id,
      provider,
      status: "QUEUED",
      createdAt: now,
    });
    return id;
  },
});
