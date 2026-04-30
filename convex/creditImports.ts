// Convex functions for the credit-import pipeline.
//
// Tables:
//   creditReportImports          — top-level import job
//   creditReportRaws             — encrypted raw payload
//   creditReportNormalized       — normalized summary (one per import)
//   creditPersonalProfiles       — per-bureau personal profile rows
//   creditTradelines             — per-bureau tradelines
//   creditInquiries              — per-bureau inquiries
//   creditCollections            — per-bureau collections
//   creditPublicRecords          — per-bureau public records
//   creditScoreSnapshots         — per-bureau score snapshots
//   creditDisputeCandidates      — generated dispute candidates
//
// All encryption (AES-256-GCM via lib/encryption.ts) happens BEFORE the
// payload reaches Convex — the mutations here accept already-encrypted
// strings and persist them as-is.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, requireUser } from "./helpers";
import type { Doc, Id } from "./_generated/dataModel";

const creditProvider = v.union(
  v.literal("IDENTITYIQ"),
  v.literal("MYSCOREIQ"),
  v.literal("MYFREESCORENOW"),
  v.literal("MANUAL"),
);

const creditImportStatus = v.union(
  v.literal("PENDING"),
  v.literal("FETCHED"),
  v.literal("VALIDATED"),
  v.literal("NORMALIZED"),
  v.literal("FAILED"),
  v.literal("ARCHIVED"),
);

const creditReportBureau = v.union(
  v.literal("EXPERIAN"),
  v.literal("EQUIFAX"),
  v.literal("TRANSUNION"),
  v.literal("UNKNOWN"),
);

const disputeCandidateStage = v.union(
  v.literal("ROUND_1"),
  v.literal("ROUND_2"),
  v.literal("MOV"),
  v.literal("DIRECT_FURNISHER"),
  v.literal("CFPB"),
  v.literal("AG"),
  v.literal("STATE_REGULATOR"),
);

const disputeCandidateReason = v.union(
  v.literal("INACCURATE"),
  v.literal("INCOMPLETE"),
  v.literal("UNVERIFIABLE"),
  v.literal("DUPLICATE"),
  v.literal("OUTDATED"),
  v.literal("IDENTITY_THEFT"),
  v.literal("BALANCE_MISMATCH"),
  v.literal("STATUS_MISMATCH"),
  v.literal("OBSOLETE_BY_AGE"),
  v.literal("MEDICAL_UNDER_LIMIT"),
  v.literal("OTHER"),
);

// ── Customer-facing queries ────────────────────────────────────────────

/**
 * Latest import for the calling user (used by status derivation).
 */
export const latestForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("creditReportImports")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
    if (rows.length === 0) return null;
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows[0];
  },
});

/**
 * All imports for the calling user.
 */
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("creditReportImports")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

/**
 * Get an import by id, scoped to the calling user. Returns the row plus
 * normalized + child counts. Returns null if not found OR not owned.
 */
export const getOwnedImport = query({
  args: { id: v.id("creditReportImports") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const imp = await ctx.db.get(id);
    if (!imp || imp.userId !== user._id) return null;
    const normalized = await ctx.db
      .query("creditReportNormalized")
      .withIndex("by_import", (q) => q.eq("importId", id))
      .unique();
    const [tradelines, inquiries, collections, publicRecords, candidates] =
      await Promise.all([
        countByImport(ctx, "creditTradelines", id),
        countByImport(ctx, "creditInquiries", id),
        countByImport(ctx, "creditCollections", id),
        countByImport(ctx, "creditPublicRecords", id),
        countByImport(ctx, "creditDisputeCandidates", id),
      ]);
    return {
      import: imp,
      normalized,
      counts: {
        tradelines,
        inquiries,
        collections,
        publicRecords,
        disputeCandidates: candidates,
      },
    };
  },
});

// ── Admin queries ──────────────────────────────────────────────────────

/**
 * Admin list with filters. Returns hydrated rows plus child counts and
 * the user's email.
 */
export const adminList = query({
  args: {
    status: v.optional(creditImportStatus),
    provider: v.optional(creditProvider),
    userId: v.optional(v.id("users")),
    emailContains: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
    const offset = Math.max(args.offset ?? 0, 0);

    let rows: Doc<"creditReportImports">[];
    if (args.userId) {
      rows = await ctx.db
        .query("creditReportImports")
        .filter((q) => q.eq(q.field("userId"), args.userId!))
        .collect();
    } else {
      rows = await ctx.db.query("creditReportImports").collect();
    }
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.provider) rows = rows.filter((r) => r.provider === args.provider);

    if (args.emailContains && args.emailContains.trim().length) {
      const needle = args.emailContains.toLowerCase();
      const userIds = new Set(rows.map((r) => r.userId));
      const userMap = new Map<Id<"users">, Doc<"users">>();
      for (const uid of userIds) {
        const u = await ctx.db.get(uid);
        if (u) userMap.set(uid, u);
      }
      rows = rows.filter((r) => {
        const u = userMap.get(r.userId);
        return u ? u.email.toLowerCase().includes(needle) : false;
      });
    }

    rows.sort((a, b) => b.createdAt - a.createdAt);
    const total = rows.length;
    const page = rows.slice(offset, offset + limit);

    const hydrated = await Promise.all(
      page.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const [tradelines, inquiries, collections, publicRecords, candidates] =
          await Promise.all([
            countByImport(ctx, "creditTradelines", r._id),
            countByImport(ctx, "creditInquiries", r._id),
            countByImport(ctx, "creditCollections", r._id),
            countByImport(ctx, "creditPublicRecords", r._id),
            countByImport(ctx, "creditDisputeCandidates", r._id),
          ]);
        return {
          ...r,
          user: user ? { id: user._id, email: user.email } : null,
          counts: {
            tradelines,
            inquiries,
            collections,
            publicRecords,
            disputeCandidates: candidates,
          },
        };
      }),
    );

    return { imports: hydrated, total, limit, offset };
  },
});

/**
 * Admin: load a full import with all children. Single fat query so the
 * detail page has everything it needs in one round trip.
 */
export const adminGet = query({
  args: { id: v.id("creditReportImports") },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const imp = await ctx.db.get(id);
    if (!imp) return null;
    const [
      user,
      raw,
      normalized,
      tradelines,
      inquiries,
      collections,
      publicRecords,
      scoreSnapshots,
      personalProfiles,
      disputeCandidates,
    ] = await Promise.all([
      ctx.db.get(imp.userId),
      ctx.db
        .query("creditReportRaws")
        .withIndex("by_import", (q) => q.eq("importId", id))
        .unique(),
      ctx.db
        .query("creditReportNormalized")
        .withIndex("by_import", (q) => q.eq("importId", id))
        .unique(),
      collectByImport(ctx, "creditTradelines", id),
      collectByImport(ctx, "creditInquiries", id),
      collectByImport(ctx, "creditCollections", id),
      collectByImport(ctx, "creditPublicRecords", id),
      collectByImport(ctx, "creditScoreSnapshots", id),
      collectByImport(ctx, "creditPersonalProfiles", id),
      collectByImport(ctx, "creditDisputeCandidates", id),
    ]);

    return {
      import: imp,
      user: user ? { id: user._id, email: user.email } : null,
      raw: raw
        ? {
            id: raw._id,
            payloadBytes: raw.payloadBytes,
            payloadHash: raw.payloadHash,
            redactionFingerprint: raw.redactionFingerprint ?? null,
            capturedAt: raw.capturedAt,
          }
        : null,
      normalized,
      tradelines,
      inquiries,
      collections,
      publicRecords,
      scoreSnapshots,
      personalProfiles,
      disputeCandidates,
    };
  },
});

/**
 * Admin: list users for the "new import" picker.
 */
export const adminListUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const rows = await ctx.db.query("users").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, limit ?? 200).map((u) => ({
      id: u._id,
      email: u.email,
      isVip: !!u.isVip,
      createdAt: u.createdAt,
      role: u.role,
    }));
  },
});

/**
 * Admin: fetch the encrypted raw payload for an import (so the API route
 * can decrypt + redact it before returning to the browser).
 */
export const adminGetRaw = query({
  args: { id: v.id("creditReportImports") },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const imp = await ctx.db.get(id);
    if (!imp) return null;
    const raw = await ctx.db
      .query("creditReportRaws")
      .withIndex("by_import", (q) => q.eq("importId", id))
      .unique();
    if (!raw) return { import: imp, raw: null };
    return { import: imp, raw };
  },
});

/**
 * Admin: fetch lifecycle audit rows for an import.
 */
export const adminListAuditRows = query({
  args: { id: v.id("creditReportImports") },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ["OWNER", "ADMIN"]);
    const imp = await ctx.db.get(id);
    if (!imp) return [];
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "CreditReportImport").eq("entityId", id),
      )
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const actor = r.actorUserId ? await ctx.db.get(r.actorUserId) : null;
        return {
          ...r,
          actorUser: actor ? { email: actor.email } : null,
        };
      }),
    );
    return hydrated;
  },
});

// ── Customer-side raw fetch (for normalize-from-server) ────────────────

/**
 * Internal-ish: fetch the encrypted raw payload for the calling user's own
 * import. Used by the API route's normalize step which needs to decrypt
 * the body in Node.js (Convex sandbox lacks node:crypto guarantees).
 */
export const getOwnedRaw = query({
  args: {
    id: v.id("creditReportImports"),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.id);
    if (!imp) return null;
    const user = await requireUser(ctx);
    if (imp.userId !== user._id) return null;
    const raw = await ctx.db
      .query("creditReportRaws")
      .withIndex("by_import", (q) => q.eq("importId", args.id))
      .unique();
    return { import: imp, raw };
  },
});

// ── Mutations ──────────────────────────────────────────────────────────

/**
 * Create a new import. Caller specifies userId (admin) or it defaults to
 * the calling user's own id (customer flow).
 */
export const createImport = mutation({
  args: {
    userId: v.optional(v.id("users")),
    provider: creditProvider,
    providerRef: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    importMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetUserId: Id<"users">;
    let actorUserId: Id<"users"> | undefined;
    const me = await requireUser(ctx);
    actorUserId = me._id;
    if (args.userId && args.userId !== me._id) {
      // Cross-user import — must be admin.
      if (me.role !== "OWNER" && me.role !== "ADMIN") {
        throw new Error("FORBIDDEN");
      }
      const target = await ctx.db.get(args.userId);
      if (!target) throw new Error("USER_NOT_FOUND");
      targetUserId = args.userId;
    } else {
      targetUserId = me._id;
    }
    const now = Date.now();
    const importId = await ctx.db.insert("creditReportImports", {
      userId: targetUserId,
      provider: args.provider,
      providerRef: args.providerRef,
      sourceUrl: args.sourceUrl,
      importMethod: args.importMethod,
      status: "PENDING",
      schemaVersion: "v1",
      parserVersion: "v1",
      bureauCoverage: [],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId,
      actorUserId,
      action: "CREDIT_IMPORT_CREATED",
      entityType: "CreditReportImport",
      entityId: importId,
      metadataJson: {
        provider: args.provider,
        sourceUrl: args.sourceUrl ?? null,
        importMethod: args.importMethod ?? null,
      },
      createdAt: now,
    });
    return await ctx.db.get(importId);
  },
});

/**
 * Patch the importMethod on an existing import. Used when the import
 * progresses through fallback methods (auto-json → browser-assisted → upload).
 */
export const setImportMethod = mutation({
  args: {
    importId: v.id("creditReportImports"),
    importMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const imp = await ctx.db.get(args.importId);
    if (!imp) throw new Error("NOT_FOUND");
    if (
      imp.userId !== me._id &&
      me.role !== "OWNER" &&
      me.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }
    await ctx.db.patch(args.importId, {
      importMethod: args.importMethod,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.importId);
  },
});

/**
 * Persist a captured raw payload. The encryption + hashing happen in the
 * Next.js API route (Node crypto); this mutation just stores the strings.
 * Re-pasting replaces the prior raw and bumps status to FETCHED.
 */
export const captureRaw = mutation({
  args: {
    importId: v.id("creditReportImports"),
    encryptedPayload: v.string(),
    payloadBytes: v.number(),
    payloadHash: v.string(),
    redactionFingerprint: v.optional(v.string()),
    contentEncoding: v.optional(v.string()),
    onlyIfOwnedByMe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.importId);
    if (!imp) throw new Error("NOT_FOUND");
    const me = await requireUser(ctx);
    const actorUserId: Id<"users"> = me._id;
    if (args.onlyIfOwnedByMe && imp.userId !== me._id) {
      throw new Error("FORBIDDEN");
    }
    if (
      !args.onlyIfOwnedByMe &&
      imp.userId !== me._id &&
      me.role !== "OWNER" &&
      me.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("creditReportRaws")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        payloadBytes: args.payloadBytes,
        payloadHash: args.payloadHash,
        redactionFingerprint: args.redactionFingerprint,
        contentEncoding: args.contentEncoding ?? existing.contentEncoding,
        capturedAt: now,
      });
    } else {
      await ctx.db.insert("creditReportRaws", {
        importId: args.importId,
        encryptedPayload: args.encryptedPayload,
        payloadBytes: args.payloadBytes,
        contentEncoding: args.contentEncoding ?? "utf8",
        payloadHash: args.payloadHash,
        capturedAt: now,
        redactionFingerprint: args.redactionFingerprint,
      });
    }
    await ctx.db.patch(args.importId, {
      status: "FETCHED" as const,
      fetchedAt: now,
      payloadHash: args.payloadHash,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      targetUserId: imp.userId,
      actorUserId,
      action: "CREDIT_IMPORT_RAW_CAPTURED",
      entityType: "CreditReportImport",
      entityId: args.importId,
      metadataJson: {
        payloadBytes: args.payloadBytes,
        payloadHash: args.payloadHash,
        redactionFingerprint: args.redactionFingerprint ?? null,
      },
      createdAt: now,
    });
    return await ctx.db.get(args.importId);
  },
});

/**
 * Mark an import as FAILED with a structured error.
 */
export const markFailed = mutation({
  args: {
    importId: v.id("creditReportImports"),
    code: v.string(),
    message: v.string(),
    detailJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.importId);
    if (!imp) throw new Error("NOT_FOUND");
    const me = await requireUser(ctx);
    if (
      imp.userId !== me._id &&
      me.role !== "OWNER" &&
      me.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }
    const now = Date.now();
    await ctx.db.patch(args.importId, {
      status: "FAILED",
      errorCode: args.code,
      errorMessage: args.message.slice(0, 2000),
      errorDetailJson: args.detailJson ?? {},
      updatedAt: now,
    });
    return await ctx.db.get(args.importId);
  },
});

/**
 * Replace-all normalization persist. Accepts the full normalized result and
 * the rendered candidate list; idempotently drops + re-inserts child rows.
 *
 * Encryption of profile fields happens in the API route — this mutation
 * receives them as already-encrypted strings.
 */
export const persistNormalization = mutation({
  args: {
    importId: v.id("creditReportImports"),
    bureauCoverage: v.array(creditReportBureau),
    parserVersion: v.string(),
    normalized: v.object({
      pulledAtMs: v.number(),
      reportIdProvider: v.optional(v.string()),
      bureaus: v.array(creditReportBureau),
      summaryJson: v.any(),
      unmappedFieldsJson: v.optional(v.any()),
      validationWarnings: v.array(v.string()),
    }),
    profiles: v.array(
      v.object({
        bureau: creditReportBureau,
        fullName: v.optional(v.string()),
        encryptedDob: v.optional(v.string()),
        encryptedSsnLast4: v.optional(v.string()),
        encryptedPrimaryAddr: v.optional(v.string()),
        cityMasked: v.optional(v.string()),
        stateCode: v.optional(v.string()),
        zipMasked: v.optional(v.string()),
        phoneMasked: v.optional(v.string()),
        employers: v.optional(v.any()),
        priorAddresses: v.optional(v.any()),
        aliases: v.array(v.string()),
        fraudAlerts: v.optional(v.any()),
        consumerStatement: v.optional(v.string()),
        unmappedFieldsJson: v.optional(v.any()),
      }),
    ),
    tradelines: v.array(
      v.object({
        bureau: creditReportBureau,
        fingerprint: v.string(),
        creditorName: v.string(),
        furnisherName: v.optional(v.string()),
        accountRefMasked: v.string(),
        accountType: v.optional(v.string()),
        accountSubtype: v.optional(v.string()),
        ownership: v.optional(v.string()),
        balanceCents: v.optional(v.number()),
        highBalanceCents: v.optional(v.number()),
        creditLimitCents: v.optional(v.number()),
        pastDueCents: v.optional(v.number()),
        monthlyPaymentCents: v.optional(v.number()),
        termsMonths: v.optional(v.number()),
        statusLabel: v.optional(v.string()),
        paymentStatus: v.optional(v.string()),
        rawStatus: v.optional(v.string()),
        openedAt: v.optional(v.number()),
        closedAt: v.optional(v.number()),
        lastReportedAt: v.optional(v.number()),
        lastActivityAt: v.optional(v.number()),
        lastPaymentAt: v.optional(v.number()),
        isCollection: v.boolean(),
        isChargeOff: v.boolean(),
        isMedical: v.boolean(),
        isDerogatory: v.boolean(),
        isClosed: v.boolean(),
        isFraudClaimed: v.boolean(),
        paymentHistoryJson: v.optional(v.any()),
        remarks: v.array(v.string()),
        unmappedFieldsJson: v.optional(v.any()),
      }),
    ),
    inquiries: v.array(
      v.object({
        bureau: creditReportBureau,
        inquirerName: v.string(),
        inquirerType: v.optional(v.string()),
        inquiryDate: v.optional(v.number()),
        isHard: v.boolean(),
        purpose: v.optional(v.string()),
        unmappedFieldsJson: v.optional(v.any()),
      }),
    ),
    collections: v.array(
      v.object({
        bureau: creditReportBureau,
        collectorName: v.string(),
        originalCreditor: v.optional(v.string()),
        accountRefMasked: v.string(),
        balanceCents: v.optional(v.number()),
        originalBalanceCents: v.optional(v.number()),
        statusLabel: v.optional(v.string()),
        assignedAt: v.optional(v.number()),
        reportedAt: v.optional(v.number()),
        firstDelinquencyAt: v.optional(v.number()),
        isMedical: v.boolean(),
        unmappedFieldsJson: v.optional(v.any()),
      }),
    ),
    publicRecords: v.array(
      v.object({
        bureau: creditReportBureau,
        recordType: v.string(),
        status: v.optional(v.string()),
        courtName: v.optional(v.string()),
        referenceNumber: v.optional(v.string()),
        filedAt: v.optional(v.number()),
        resolvedAt: v.optional(v.number()),
        amountCents: v.optional(v.number()),
        unmappedFieldsJson: v.optional(v.any()),
      }),
    ),
    scoreSnapshots: v.array(
      v.object({
        bureau: creditReportBureau,
        scoreModel: v.string(),
        score: v.number(),
        rangeMin: v.optional(v.number()),
        rangeMax: v.optional(v.number()),
        factors: v.array(v.string()),
        pulledAt: v.optional(v.number()),
      }),
    ),
    candidates: v.array(
      v.object({
        tradelineFingerprint: v.optional(v.string()),
        bureau: creditReportBureau,
        stage: disputeCandidateStage,
        reason: disputeCandidateReason,
        reasonCodes: v.array(v.string()),
        severity: v.string(),
        summary: v.string(),
        evidenceJson: v.any(),
        legalBasis: v.array(v.string()),
        confidence: v.string(),
      }),
    ),
    auditMetadataJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.importId);
    if (!imp) throw new Error("NOT_FOUND");
    const me = await requireUser(ctx);
    const actorUserId: Id<"users"> = me._id;
    if (
      imp.userId !== me._id &&
      me.role !== "OWNER" &&
      me.role !== "ADMIN"
    ) {
      throw new Error("FORBIDDEN");
    }

    // Drop existing children.
    const tables = [
      "creditDisputeCandidates",
      "creditTradelines",
      "creditInquiries",
      "creditCollections",
      "creditPublicRecords",
      "creditScoreSnapshots",
      "creditPersonalProfiles",
      "creditReportNormalized",
    ] as const;
    for (const tbl of tables) {
      const rows = await collectByImport(ctx, tbl, args.importId);
      for (const r of rows) await ctx.db.delete(r._id);
    }

    const now = Date.now();
    await ctx.db.insert("creditReportNormalized", {
      importId: args.importId,
      pulledAt: args.normalized.pulledAtMs,
      reportIdProvider: args.normalized.reportIdProvider,
      bureaus: args.normalized.bureaus,
      summaryJson: args.normalized.summaryJson,
      unmappedFieldsJson: args.normalized.unmappedFieldsJson,
      validationWarnings: args.normalized.validationWarnings,
      createdAt: now,
    });

    for (const p of args.profiles) {
      await ctx.db.insert("creditPersonalProfiles", {
        importId: args.importId,
        bureau: p.bureau,
        fullName: p.fullName,
        encryptedDob: p.encryptedDob,
        encryptedSsnLast4: p.encryptedSsnLast4,
        encryptedPrimaryAddr: p.encryptedPrimaryAddr,
        cityMasked: p.cityMasked,
        stateCode: p.stateCode,
        zipMasked: p.zipMasked,
        phoneMasked: p.phoneMasked,
        employers: p.employers,
        priorAddresses: p.priorAddresses,
        aliases: p.aliases,
        fraudAlerts: p.fraudAlerts,
        consumerStatement: p.consumerStatement,
        unmappedFieldsJson: p.unmappedFieldsJson,
        createdAt: now,
      });
    }

    // Insert tradelines and remember id->fingerprint for candidate linking.
    const fingerprintToId = new Map<string, Id<"creditTradelines">>();
    for (const t of args.tradelines) {
      const id = await ctx.db.insert("creditTradelines", {
        importId: args.importId,
        bureau: t.bureau,
        fingerprint: t.fingerprint,
        creditorName: t.creditorName,
        furnisherName: t.furnisherName,
        accountRefMasked: t.accountRefMasked,
        accountType: t.accountType,
        accountSubtype: t.accountSubtype,
        ownership: t.ownership,
        balanceCents: t.balanceCents,
        highBalanceCents: t.highBalanceCents,
        creditLimitCents: t.creditLimitCents,
        pastDueCents: t.pastDueCents,
        monthlyPaymentCents: t.monthlyPaymentCents,
        termsMonths: t.termsMonths,
        statusLabel: t.statusLabel,
        paymentStatus: t.paymentStatus,
        rawStatus: t.rawStatus,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
        lastReportedAt: t.lastReportedAt,
        lastActivityAt: t.lastActivityAt,
        lastPaymentAt: t.lastPaymentAt,
        isCollection: t.isCollection,
        isChargeOff: t.isChargeOff,
        isMedical: t.isMedical,
        isDerogatory: t.isDerogatory,
        isClosed: t.isClosed,
        isFraudClaimed: t.isFraudClaimed,
        paymentHistoryJson: t.paymentHistoryJson,
        remarks: t.remarks,
        disputeFlags: [],
        unmappedFieldsJson: t.unmappedFieldsJson,
        createdAt: now,
      });
      fingerprintToId.set(`${t.bureau}::${t.fingerprint}`, id);
    }

    for (const q of args.inquiries) {
      await ctx.db.insert("creditInquiries", {
        importId: args.importId,
        bureau: q.bureau,
        inquirerName: q.inquirerName,
        inquirerType: q.inquirerType,
        inquiryDate: q.inquiryDate,
        isHard: q.isHard,
        purpose: q.purpose,
        unmappedFieldsJson: q.unmappedFieldsJson,
        createdAt: now,
      });
    }
    for (const c of args.collections) {
      await ctx.db.insert("creditCollections", {
        importId: args.importId,
        bureau: c.bureau,
        collectorName: c.collectorName,
        originalCreditor: c.originalCreditor,
        accountRefMasked: c.accountRefMasked,
        balanceCents: c.balanceCents,
        originalBalanceCents: c.originalBalanceCents,
        statusLabel: c.statusLabel,
        assignedAt: c.assignedAt,
        reportedAt: c.reportedAt,
        firstDelinquencyAt: c.firstDelinquencyAt,
        isMedical: c.isMedical,
        unmappedFieldsJson: c.unmappedFieldsJson,
        createdAt: now,
      });
    }
    for (const r of args.publicRecords) {
      await ctx.db.insert("creditPublicRecords", {
        importId: args.importId,
        bureau: r.bureau,
        recordType: r.recordType,
        status: r.status,
        courtName: r.courtName,
        referenceNumber: r.referenceNumber,
        filedAt: r.filedAt,
        resolvedAt: r.resolvedAt,
        amountCents: r.amountCents,
        unmappedFieldsJson: r.unmappedFieldsJson,
        createdAt: now,
      });
    }
    for (const s of args.scoreSnapshots) {
      await ctx.db.insert("creditScoreSnapshots", {
        importId: args.importId,
        bureau: s.bureau,
        scoreModel: s.scoreModel,
        score: s.score,
        rangeMin: s.rangeMin,
        rangeMax: s.rangeMax,
        factors: s.factors,
        pulledAt: s.pulledAt,
        createdAt: now,
      });
    }
    for (const cand of args.candidates) {
      const key = cand.tradelineFingerprint
        ? `${cand.bureau}::${cand.tradelineFingerprint}`
        : undefined;
      const tradelineId = key ? fingerprintToId.get(key) : undefined;
      await ctx.db.insert("creditDisputeCandidates", {
        importId: args.importId,
        tradelineId,
        bureau: cand.bureau,
        stage: cand.stage,
        reason: cand.reason,
        reasonCodes: cand.reasonCodes,
        severity: cand.severity,
        summary: cand.summary,
        evidenceJson: cand.evidenceJson,
        legalBasis: cand.legalBasis,
        confidence: cand.confidence,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.importId, {
      status: "NORMALIZED" as const,
      normalizedAt: now,
      validatedAt: now,
      parserVersion: args.parserVersion,
      bureauCoverage: args.bureauCoverage,
      errorDetailJson: {},
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      targetUserId: imp.userId,
      actorUserId,
      action: "CREDIT_IMPORT_NORMALIZED",
      entityType: "CreditReportImport",
      entityId: args.importId,
      metadataJson: args.auditMetadataJson ?? {},
      createdAt: now,
    });

    return { ok: true };
  },
});

/**
 * Audit-only entry — used by the inspect-raw endpoint to log that an admin
 * decrypted + viewed a payload.
 */
export const writeRawInspectedAudit = mutation({
  args: {
    importId: v.id("creditReportImports"),
    payloadHash: v.string(),
  },
  handler: async (ctx, { importId, payloadHash }) => {
    const me = await requireRole(ctx, ["OWNER", "ADMIN"]);
    const imp = await ctx.db.get(importId);
    if (!imp) throw new Error("NOT_FOUND");
    await ctx.db.insert("auditLogs", {
      actorUserId: me._id,
      targetUserId: imp.userId,
      action: "CREDIT_IMPORT_RAW_INSPECTED",
      entityType: "CreditReportImport",
      entityId: importId,
      metadataJson: { payloadHash },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Tables that key children by importId. Some use the `by_import` index
 * (single-column) and some use `by_import_bureau` (composite, leading
 * column is importId). Both can be queried by `q.eq("importId", id)`.
 */
type ChildTable =
  | "creditTradelines"
  | "creditInquiries"
  | "creditCollections"
  | "creditPublicRecords"
  | "creditDisputeCandidates"
  | "creditPersonalProfiles"
  | "creditScoreSnapshots"
  | "creditReportNormalized";

const BY_IMPORT_BUREAU: ReadonlySet<ChildTable> = new Set<ChildTable>([
  "creditTradelines",
  "creditInquiries",
  "creditCollections",
  "creditPublicRecords",
  "creditDisputeCandidates",
  "creditPersonalProfiles",
  "creditScoreSnapshots",
]);

async function collectByImport(
  ctx: { db: any },
  table: ChildTable,
  importId: Id<"creditReportImports">,
): Promise<any[]> {
  if (BY_IMPORT_BUREAU.has(table)) {
    return await ctx.db
      .query(table)
      .withIndex("by_import_bureau", (q: any) => q.eq("importId", importId))
      .collect();
  }
  return await ctx.db
    .query(table)
    .withIndex("by_import", (q: any) => q.eq("importId", importId))
    .collect();
}

async function countByImport(
  ctx: { db: any },
  table: ChildTable,
  importId: Id<"creditReportImports">,
): Promise<number> {
  const rows = await collectByImport(ctx, table, importId);
  return rows.length;
}
