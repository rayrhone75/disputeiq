// Append-only event log for /api/reports/upload-any.
//
// Every upload attempt — accepted, rejected, parsed, queued for review —
// produces exactly one `importHealthEvents` row. The /admin/import-health
// dashboard reads from here to answer:
//   - Are uploads succeeding overall?
//   - Which file formats are being submitted?
//   - Which parser branch (json / embedded-json / *-heuristic) handled
//     them?
//   - Which uploads ended up needing human review?
//
// We never store the file body or the user's email here — only counts,
// the parser path taken, and a truncated error string when relevant.
// Hydration to a user email happens at query time on the admin side.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers";
import type { Doc } from "./_generated/dataModel";

const formatLiteral = v.union(
  v.literal("json"),
  v.literal("pdf"),
  v.literal("html"),
  v.literal("txt"),
  v.literal("unknown"),
);

const parserPathLiteral = v.union(
  v.literal("json"),
  v.literal("json-paralegal"),
  v.literal("text-paralegal"),
  v.literal("html-paralegal"),
  v.literal("pdf-mistral-paralegal"),
  // Legacy values kept for old importHealthEvents rows.
  v.literal("embedded-json"),
  v.literal("pdf-heuristic"),
  v.literal("html-heuristic"),
  v.literal("txt-heuristic"),
  v.literal("rejected"),
);

function assertInternalSecret(secret: string) {
  const expected = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!expected || secret !== expected) throw new Error("FORBIDDEN");
}

// ── Service-secret writer ──────────────────────────────────────────────
// Called from the Next.js upload route via fetchMutation. The route
// holds INTERNAL_SERVICE_SECRET; the browser does not, so this stays
// out of any public-API surface even though it's registered as a public
// `mutation` (Convex requires that for cross-project fetchMutation).
export const record = mutation({
  args: {
    secret: v.string(),
    clerkUserId: v.optional(v.string()),
    format: formatLiteral,
    parserPath: parserPathLiteral,
    ok: v.boolean(),
    parseStatus: v.optional(v.string()),
    tradelineCount: v.number(),
    candidateCount: v.optional(v.number()),
    fileSize: v.optional(v.number()),
    fileName: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const id = await ctx.db.insert("importHealthEvents", {
      clerkUserId: args.clerkUserId,
      format: args.format,
      parserPath: args.parserPath,
      ok: args.ok,
      parseStatus: args.parseStatus,
      tradelineCount: args.tradelineCount,
      candidateCount: args.candidateCount,
      fileSize: args.fileSize,
      fileName: args.fileName?.slice(0, 200),
      errorMessage: args.errorMessage?.slice(0, 500),
      createdAt: Date.now(),
    });
    return id;
  },
});

// ── Admin queries ──────────────────────────────────────────────────────

type FormatKey = Doc<"importHealthEvents">["format"];
type ParserPathKey = Doc<"importHealthEvents">["parserPath"];

export type ImportHealthAggregate = {
  total: number;
  ok: number;
  failed: number;
  needsReview: number;
  successRate: number;
  byFormat: Record<FormatKey, { total: number; ok: number; failed: number }>;
  byParserPath: Record<ParserPathKey, number>;
  windowMs: number;
  windowStart: number;
};

const FORMATS: FormatKey[] = ["json", "pdf", "html", "txt", "unknown"];
const PARSER_PATHS: ParserPathKey[] = [
  "json",
  "embedded-json",
  "pdf-heuristic",
  "html-heuristic",
  "txt-heuristic",
  "rejected",
];

/**
 * Headline numbers + per-format / per-parser breakdown over the last N
 * days (default 30). Single read — admin/import-health calls this once
 * per page render.
 */
export const aggregate = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }): Promise<ImportHealthAggregate> => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const windowDays = Math.min(Math.max(days ?? 30, 1), 365);
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const windowStart = Date.now() - windowMs;

    const rows = await ctx.db
      .query("importHealthEvents")
      .withIndex("by_created", (q) => q.gte("createdAt", windowStart))
      .order("desc")
      .collect();

    const byFormat = Object.fromEntries(
      FORMATS.map((f) => [f, { total: 0, ok: 0, failed: 0 }]),
    ) as ImportHealthAggregate["byFormat"];
    const byParserPath = Object.fromEntries(
      PARSER_PATHS.map((p) => [p, 0]),
    ) as ImportHealthAggregate["byParserPath"];

    let ok = 0;
    let failed = 0;
    let needsReview = 0;

    for (const r of rows) {
      byFormat[r.format].total += 1;
      if (r.ok) {
        ok += 1;
        byFormat[r.format].ok += 1;
      } else {
        failed += 1;
        byFormat[r.format].failed += 1;
      }
      if (r.parseStatus === "needs_manual_review") needsReview += 1;
      byParserPath[r.parserPath] += 1;
    }

    const total = rows.length;
    const successRate = total === 0 ? 0 : ok / total;

    return {
      total,
      ok,
      failed,
      needsReview,
      successRate,
      byFormat,
      byParserPath,
      windowMs,
      windowStart,
    };
  },
});

export type ImportHealthRecent = Array<
  Doc<"importHealthEvents"> & { actorEmail: string | null }
>;

/**
 * Single event detail for the /admin/import-health/[id] drill-down.
 * Hydrates the customer's email by Clerk subject so the page can show
 * a useful header without a second round-trip.
 */
export const byId = query({
  args: { id: v.id("importHealthEvents") },
  handler: async (
    ctx,
    { id },
  ): Promise<
    | (Doc<"importHealthEvents"> & { actorEmail: string | null })
    | null
  > => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const row = await ctx.db.get(id);
    if (!row) return null;
    let actorEmail: string | null = null;
    if (row.clerkUserId) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkUserId", row.clerkUserId!))
        .unique();
      if (u) actorEmail = u.email;
    }
    return { ...row, actorEmail };
  },
});

/**
 * Latest N attempts with the customer's email hydrated for display. The
 * admin table renders one row per import-health event.
 */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<ImportHealthRecent> => {
    await requireRole(ctx, ["OWNER", "ADMIN", "SUPPORT"]);
    const take = Math.min(Math.max(limit ?? 25, 1), 200);
    const rows = await ctx.db
      .query("importHealthEvents")
      .withIndex("by_created")
      .order("desc")
      .take(take);

    // Hydrate by Clerk subject. Missing rows render with null email —
    // useful signal that auth state was unusual at upload time.
    const clerkIds = Array.from(
      new Set(rows.map((r) => r.clerkUserId).filter(Boolean)),
    ) as string[];
    const userByClerk = new Map<string, string>();
    for (const cid of clerkIds) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkUserId", cid))
        .unique();
      if (u) userByClerk.set(cid, u.email);
    }
    return rows.map((r) => ({
      ...r,
      actorEmail: r.clerkUserId
        ? userByClerk.get(r.clerkUserId) ?? null
        : null,
    }));
  },
});
