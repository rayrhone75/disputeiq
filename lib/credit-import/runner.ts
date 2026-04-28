// Import job orchestrator (Convex-backed).
//
// Responsibilities:
//   - Create an import record (PENDING)
//   - Fetch or accept-pasted raw JSON
//   - Encrypt + persist the raw body (creditReportRaws)
//   - Run provider-specific normalization
//   - Persist normalized entities (tradelines, inquiries, collections, etc.)
//   - Emit dispute candidates
//   - Record audit trail at every step
//
// The orchestration runs in the Next.js Node runtime so we can use Node
// crypto for encryption. Each step calls a Convex mutation/query via
// `fetchMutation` / `fetchQuery`, passing the caller's Clerk JWT.
//
// Convex mutations are atomic per-call; we don't try to span an admin
// transaction across HTTP boundaries. The "replace" path inside
// persistNormalization is itself a single Convex mutation, so a partial
// re-normalization can't leave child rows half-rewritten.

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decrypt, encrypt } from "@/lib/encryption";
import { redactJson } from "./redact";
import { getAdapter, detectAdapter } from "./providers";
import { fetchProviderJson, parseProviderJson, ProviderFetchError } from "./fetcher";
import { NormalizedReportZ } from "./schemas";
import { runDisputeEngine } from "./dispute-engine";
import { sha256, stableStringify, toDate } from "./util";
import { tradelineFingerprint } from "./util";
import type {
  CreditProvider,
  CreditReportBureau,
  NormalizedReport,
} from "./types";

const RUNNER_VERSION = "v1";

export type RunnerCtx = { token: string | null };

export class ImportRunnerError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ImportRunnerError";
  }
}

const dateMs = (iso?: string): number | undefined => {
  const d = toDate(iso);
  return d ? d.getTime() : undefined;
};

export async function createImport(
  ctx: RunnerCtx,
  input: {
    userId?: Id<"users">;
    provider: CreditProvider;
    providerRef?: string;
    sourceUrl?: string;
    importMethod?: string;
  },
) {
  return await fetchMutation(
    api.creditImports.createImport,
    {
      userId: input.userId,
      provider: input.provider,
      providerRef: input.providerRef,
      sourceUrl: input.sourceUrl,
      importMethod: input.importMethod,
    },
    { token: ctx.token ?? undefined },
  );
}

/**
 * Capture a raw JSON body against an import (paste-in flow).
 * The body is encrypted in this Node process, then persisted.
 */
export async function captureRaw(
  ctx: RunnerCtx,
  opts: {
    importId: Id<"creditReportImports">;
    bodyText?: string;
    json?: unknown;
    onlyIfOwnedByMe?: boolean;
  },
) {
  if (!opts.bodyText && opts.json === undefined) {
    throw new ImportRunnerError("NO_INPUT", "Either bodyText or json is required.");
  }
  const bodyText = opts.bodyText ?? JSON.stringify(opts.json);
  const payloadHash = sha256(bodyText);

  let parsed: unknown;
  try {
    parsed = opts.json !== undefined ? opts.json : JSON.parse(bodyText);
  } catch (err) {
    throw new ImportRunnerError(
      "PARSE_ERROR",
      `Pasted body is not valid JSON: ${(err as Error).message}`,
    );
  }

  const encryptedPayload = encrypt(bodyText);
  const redactionFingerprint = sha256(stableStringify(redactJson(parsed)));

  return await fetchMutation(
    api.creditImports.captureRaw,
    {
      importId: opts.importId,
      encryptedPayload,
      payloadBytes: Buffer.byteLength(bodyText, "utf8"),
      payloadHash,
      redactionFingerprint,
      onlyIfOwnedByMe: opts.onlyIfOwnedByMe,
    },
    { token: ctx.token ?? undefined },
  );
}

/**
 * Fetch provider JSON over the network and capture it.
 */
export async function fetchAndCapture(
  ctx: RunnerCtx,
  opts: {
    importId: Id<"creditReportImports">;
    url: string;
    cookieHeader?: string;
    bearerToken?: string;
    onlyIfOwnedByMe?: boolean;
  },
) {
  try {
    const res = await fetchProviderJson({
      url: opts.url,
      cookieHeader: opts.cookieHeader,
      bearerToken: opts.bearerToken,
    });
    try {
      parseProviderJson(res.bodyText);
    } catch (err) {
      await markFailed(ctx, opts.importId, (err as ProviderFetchError).code, (err as Error).message);
      throw err;
    }
    return await captureRaw(ctx, {
      importId: opts.importId,
      bodyText: res.bodyText,
      onlyIfOwnedByMe: opts.onlyIfOwnedByMe,
    });
  } catch (err) {
    if (err instanceof ProviderFetchError) {
      await markFailed(ctx, opts.importId, err.code, err.message);
    }
    throw err;
  }
}

async function markFailed(
  ctx: RunnerCtx,
  importId: Id<"creditReportImports">,
  code: string,
  message: string,
  detail?: Record<string, unknown>,
) {
  await fetchMutation(
    api.creditImports.markFailed,
    { importId, code, message, detailJson: detail ?? {} },
    { token: ctx.token ?? undefined },
  );
}

/**
 * Run normalization over the already-captured raw payload.
 * `replace` is the only supported mode — child rows are dropped + re-inserted
 * inside the persistNormalization Convex mutation.
 */
export async function runNormalization(
  ctx: RunnerCtx,
  opts: { importId: Id<"creditReportImports"> },
): Promise<{ report: NormalizedReport; candidatesCreated: number }> {
  const fetched = await fetchQuery(
    api.creditImports.getOwnedRaw,
    { id: opts.importId },
    { token: ctx.token ?? undefined },
  );
  if (!fetched) throw new ImportRunnerError("NOT_FOUND", "Import not found.");
  const { import: imp, raw } = fetched;
  if (!raw) throw new ImportRunnerError("NO_RAW", "Raw payload has not been captured yet.");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decrypt(raw.encryptedPayload));
  } catch (err) {
    await markFailed(ctx, opts.importId, "DECRYPT_OR_PARSE", (err as Error).message);
    throw new ImportRunnerError("DECRYPT_OR_PARSE", (err as Error).message);
  }

  const adapter =
    imp.provider === "MANUAL" ? detectAdapter(parsedJson) : getAdapter(imp.provider);

  let normalized: NormalizedReport;
  try {
    normalized = adapter.normalize(parsedJson);
  } catch (err) {
    await markFailed(ctx, opts.importId, "NORMALIZE_FAILED", (err as Error).message);
    throw new ImportRunnerError("NORMALIZE_FAILED", (err as Error).message);
  }

  const zParse = NormalizedReportZ.safeParse(normalized);
  if (!zParse.success) {
    const msg = zParse.error.errors
      .slice(0, 5)
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    await markFailed(ctx, opts.importId, "VALIDATION_FAILED", msg, {
      issues: zParse.error.format() as unknown as Record<string, unknown>,
    });
    throw new ImportRunnerError("VALIDATION_FAILED", msg);
  }

  const candidates = runDisputeEngine(normalized);
  const bureauCoverage: CreditReportBureau[] = normalized.bureausDetected;

  await fetchMutation(
    api.creditImports.persistNormalization,
    {
      importId: opts.importId,
      bureauCoverage,
      parserVersion: RUNNER_VERSION,
      normalized: {
        pulledAtMs: dateMs(normalized.pulledAt) ?? Date.now(),
        reportIdProvider: normalized.providerReportId,
        bureaus: bureauCoverage,
        summaryJson: normalized.summary,
        unmappedFieldsJson: normalized.unmapped ?? {},
        validationWarnings: normalized.validationWarnings,
      },
      profiles: normalized.profiles.map((p) => ({
        bureau: p.bureau,
        fullName: p.fullName,
        encryptedDob: p.dob ? encrypt(p.dob) : undefined,
        encryptedSsnLast4: p.ssnLast4 ? encrypt(p.ssnLast4) : undefined,
        encryptedPrimaryAddr: p.addressLine1 ? encrypt(p.addressLine1) : undefined,
        cityMasked: p.city,
        stateCode: p.stateCode,
        zipMasked: p.zip,
        phoneMasked: p.phone,
        employers: p.employers ?? undefined,
        priorAddresses: p.priorAddresses ?? undefined,
        aliases: p.aliases ?? [],
        fraudAlerts: p.fraudAlerts ?? undefined,
        consumerStatement: p.consumerStatement,
        unmappedFieldsJson: p.unmapped ?? {},
      })),
      tradelines: normalized.tradelines.map((t) => ({
        bureau: t.bureau,
        fingerprint: tradelineFingerprint({
          bureau: t.bureau,
          creditorName: t.creditorName,
          accountRefMasked: t.accountRefMasked,
        }),
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
        openedAt: dateMs(t.openedAt),
        closedAt: dateMs(t.closedAt),
        lastReportedAt: dateMs(t.lastReportedAt),
        lastActivityAt: dateMs(t.lastActivityAt),
        lastPaymentAt: dateMs(t.lastPaymentAt),
        isCollection: !!t.isCollection,
        isChargeOff: !!t.isChargeOff,
        isMedical: !!t.isMedical,
        isDerogatory: !!t.isDerogatory,
        isClosed: !!t.isClosed,
        isFraudClaimed: !!t.isFraudClaimed,
        paymentHistoryJson: t.paymentHistory ?? undefined,
        remarks: t.remarks ?? [],
        unmappedFieldsJson: t.unmapped ?? {},
      })),
      inquiries: normalized.inquiries.map((q) => ({
        bureau: q.bureau,
        inquirerName: q.inquirerName,
        inquirerType: q.inquirerType,
        inquiryDate: dateMs(q.inquiryDate),
        isHard: q.isHard !== false,
        purpose: q.purpose,
        unmappedFieldsJson: q.unmapped ?? {},
      })),
      collections: normalized.collections.map((c) => ({
        bureau: c.bureau,
        collectorName: c.collectorName,
        originalCreditor: c.originalCreditor,
        accountRefMasked: c.accountRefMasked,
        balanceCents: c.balanceCents,
        originalBalanceCents: c.originalBalanceCents,
        statusLabel: c.statusLabel,
        assignedAt: dateMs(c.assignedAt),
        reportedAt: dateMs(c.reportedAt),
        firstDelinquencyAt: dateMs(c.firstDelinquencyAt),
        isMedical: !!c.isMedical,
        unmappedFieldsJson: c.unmapped ?? {},
      })),
      publicRecords: normalized.publicRecords.map((r) => ({
        bureau: r.bureau,
        recordType: r.recordType,
        status: r.status,
        courtName: r.courtName,
        referenceNumber: r.referenceNumber,
        filedAt: dateMs(r.filedAt),
        resolvedAt: dateMs(r.resolvedAt),
        amountCents: r.amountCents,
        unmappedFieldsJson: r.unmapped ?? {},
      })),
      scoreSnapshots: normalized.scores.map((s) => ({
        bureau: s.bureau,
        scoreModel: s.scoreModel,
        score: s.score,
        rangeMin: s.rangeMin,
        rangeMax: s.rangeMax,
        factors: s.factors ?? [],
        pulledAt: dateMs(s.pulledAt),
      })),
      candidates: candidates.map((c) => ({
        tradelineFingerprint: c.tradelineFingerprint,
        bureau: c.bureau,
        stage: c.stage,
        reason: c.reason,
        reasonCodes: c.reasonCodes,
        severity: c.severity,
        summary: c.summary,
        evidenceJson: c.evidenceJson,
        legalBasis: c.legalBasis,
        confidence: c.confidence,
      })),
      auditMetadataJson: {
        provider: imp.provider,
        bureausDetected: normalized.bureausDetected,
        tradelineCount: normalized.tradelines.length,
        inquiryCount: normalized.inquiries.length,
        collectionCount: normalized.collections.length,
        publicRecordCount: normalized.publicRecords.length,
        candidateCount: candidates.length,
        validationWarnings: normalized.validationWarnings,
      },
    },
    { token: ctx.token ?? undefined },
  );

  return { report: normalized, candidatesCreated: candidates.length };
}

/**
 * Preview-only: run an adapter against a raw body and return the normalized
 * shape without touching the database. Used by the admin UI's "Preview" tab.
 */
export async function previewRaw(opts: {
  provider: CreditProvider;
  bodyText?: string;
  json?: unknown;
}) {
  const parsed = opts.json !== undefined ? opts.json : JSON.parse(opts.bodyText ?? "null");
  const adapter = opts.provider === "MANUAL" ? detectAdapter(parsed) : getAdapter(opts.provider);
  const normalized = adapter.normalize(parsed);
  const candidates = runDisputeEngine(normalized);
  return { normalized, candidates };
}
