// Import job orchestrator.
//
// Responsibilities:
//   - Create an import record (PENDING)
//   - Fetch or accept-pasted raw JSON
//   - Encrypt + persist the raw body (CreditReportRaw)
//   - Run provider-specific normalization
//   - Persist normalized entities (tradelines, inquiries, collections, etc.)
//   - Emit dispute candidates
//   - Record audit trail at every step
//
// All mutations are wrapped in a transaction so a partial failure leaves
// the import in a known state with a structured error, not half-written data.
// Re-running normalization on the same import is idempotent: we drop and
// re-insert child rows under the import id.

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/audit";
import { redactJson } from "./redact";
import { getAdapter, detectAdapter } from "./providers";
import { fetchProviderJson, parseProviderJson, ProviderFetchError } from "./fetcher";
import { NormalizedReportZ } from "./schemas";
import { runDisputeEngine } from "./dispute-engine";
import { sha256, stableStringify, toDate, tradelineFingerprint } from "./util";
import { toCreditReportBureau } from "./types";
import type { NormalizedReport } from "./types";
import type {
  CreditImportStatus,
  CreditProvider,
  CreditReportBureau,
  Prisma,
} from "@prisma/client";

const RUNNER_VERSION = "v1";

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

export async function createImport(input: {
  userId: string;
  provider: CreditProvider;
  providerRef?: string;
  sourceUrl?: string;
  actorUserId?: string;
}) {
  const imp = await prisma.creditReportImport.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      providerRef: input.providerRef,
      sourceUrl: input.sourceUrl,
      status: "PENDING",
    },
  });
  await writeAuditLog({
    targetUserId: input.userId,
    actorUserId: input.actorUserId,
    action: "CREDIT_IMPORT_CREATED",
    entityType: "CreditReportImport",
    entityId: imp.id,
    metadataJson: {
      provider: input.provider,
      sourceUrl: input.sourceUrl ?? null,
    },
  });
  return imp;
}

/**
 * Capture a raw JSON body against an import (paste-in flow).
 * The body is persisted encrypted and the import advances to FETCHED.
 */
export async function captureRaw(opts: {
  importId: string;
  bodyText?: string;
  json?: unknown;
  actorUserId?: string;
}) {
  if (!opts.bodyText && opts.json === undefined) {
    throw new ImportRunnerError("NO_INPUT", "Either bodyText or json is required.");
  }
  const bodyText = opts.bodyText ?? JSON.stringify(opts.json);
  const payloadHash = sha256(bodyText);
  // Parse eagerly so we surface a malformed body before persisting.
  let _parsed: unknown;
  try {
    _parsed = opts.json !== undefined ? opts.json : JSON.parse(bodyText);
  } catch (err) {
    throw new ImportRunnerError(
      "PARSE_ERROR",
      `Pasted body is not valid JSON: ${(err as Error).message}`,
    );
  }
  void _parsed;

  const encryptedPayload = encrypt(bodyText);
  const redactionFingerprint = sha256(stableStringify(redactJson(_parsed)));

  const imp = await prisma.$transaction(async (tx) => {
    const existing = await tx.creditReportImport.findUnique({ where: { id: opts.importId } });
    if (!existing) throw new ImportRunnerError("NOT_FOUND", "Import not found.");
    // Upsert raw capture: re-pasting replaces prior raw.
    await tx.creditReportRaw.upsert({
      where: { importId: opts.importId },
      create: {
        importId: opts.importId,
        encryptedPayload,
        payloadBytes: Buffer.byteLength(bodyText, "utf8"),
        payloadHash,
        redactionFingerprint,
      },
      update: {
        encryptedPayload,
        payloadBytes: Buffer.byteLength(bodyText, "utf8"),
        payloadHash,
        redactionFingerprint,
        capturedAt: new Date(),
      },
    });
    return tx.creditReportImport.update({
      where: { id: opts.importId },
      data: {
        status: "FETCHED",
        fetchedAt: new Date(),
        payloadHash,
        errorCode: null,
        errorMessage: null,
      },
    });
  });

  await writeAuditLog({
    targetUserId: imp.userId,
    actorUserId: opts.actorUserId,
    action: "CREDIT_IMPORT_RAW_CAPTURED",
    entityType: "CreditReportImport",
    entityId: imp.id,
    metadataJson: {
      payloadBytes: Buffer.byteLength(bodyText, "utf8"),
      payloadHash,
      redactionFingerprint,
    },
  });
  return imp;
}

/**
 * Fetch provider JSON over the network and capture it.
 */
export async function fetchAndCapture(opts: {
  importId: string;
  url: string;
  cookieHeader?: string;
  bearerToken?: string;
  actorUserId?: string;
}) {
  try {
    const res = await fetchProviderJson({
      url: opts.url,
      cookieHeader: opts.cookieHeader,
      bearerToken: opts.bearerToken,
    });
    try {
      parseProviderJson(res.bodyText);
    } catch (err) {
      await markFailed(opts.importId, (err as ProviderFetchError).code, (err as Error).message);
      throw err;
    }
    return captureRaw({
      importId: opts.importId,
      bodyText: res.bodyText,
      actorUserId: opts.actorUserId,
    });
  } catch (err) {
    if (err instanceof ProviderFetchError) {
      await markFailed(opts.importId, err.code, err.message);
    }
    throw err;
  }
}

async function markFailed(importId: string, code: string, message: string, detail?: Record<string, unknown>) {
  await prisma.creditReportImport.update({
    where: { id: importId },
    data: {
      status: "FAILED",
      errorCode: code,
      errorMessage: message.slice(0, 2000),
      errorDetailJson: (detail ?? {}) as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Run normalization over the already-captured raw payload.
 * Idempotent when `replace = true` (default): we delete previously normalized
 * child rows and re-insert from the current adapter run.
 */
export async function runNormalization(opts: {
  importId: string;
  replace?: boolean;
  actorUserId?: string;
}): Promise<{ report: NormalizedReport; candidatesCreated: number }> {
  const replace = opts.replace !== false;

  const imp = await prisma.creditReportImport.findUnique({
    where: { id: opts.importId },
    include: { raw: true },
  });
  if (!imp) throw new ImportRunnerError("NOT_FOUND", "Import not found.");
  if (!imp.raw) throw new ImportRunnerError("NO_RAW", "Raw payload has not been captured yet.");

  // Decrypt → parse → normalize
  let parsed: unknown;
  try {
    const { decrypt } = await import("@/lib/encryption");
    parsed = JSON.parse(decrypt(imp.raw.encryptedPayload));
  } catch (err) {
    await markFailed(imp.id, "DECRYPT_OR_PARSE", (err as Error).message);
    throw new ImportRunnerError("DECRYPT_OR_PARSE", (err as Error).message);
  }

  const adapter =
    imp.provider === "MANUAL" ? detectAdapter(parsed) : getAdapter(imp.provider);

  let normalized: NormalizedReport;
  try {
    normalized = adapter.normalize(parsed);
  } catch (err) {
    await markFailed(imp.id, "NORMALIZE_FAILED", (err as Error).message);
    throw new ImportRunnerError("NORMALIZE_FAILED", (err as Error).message);
  }

  const zParse = NormalizedReportZ.safeParse(normalized);
  if (!zParse.success) {
    const msg = zParse.error.errors.slice(0, 5).map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    await markFailed(imp.id, "VALIDATION_FAILED", msg, { issues: zParse.error.format() as unknown as Record<string, unknown> });
    throw new ImportRunnerError("VALIDATION_FAILED", msg);
  }

  // Persist normalized entities transactionally.
  const candidates = runDisputeEngine(normalized);
  const bureauCoverage: CreditReportBureau[] = normalized.bureausDetected.map(toCreditReportBureau);

  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.creditDisputeCandidate.deleteMany({ where: { importId: imp.id } });
      await tx.creditTradeline.deleteMany({ where: { importId: imp.id } });
      await tx.creditInquiry.deleteMany({ where: { importId: imp.id } });
      await tx.creditCollection.deleteMany({ where: { importId: imp.id } });
      await tx.creditPublicRecord.deleteMany({ where: { importId: imp.id } });
      await tx.creditScoreSnapshot.deleteMany({ where: { importId: imp.id } });
      await tx.creditPersonalProfile.deleteMany({ where: { importId: imp.id } });
      await tx.creditReportNormalized.deleteMany({ where: { importId: imp.id } });
    }

    await tx.creditReportNormalized.create({
      data: {
        importId: imp.id,
        pulledAt: toDate(normalized.pulledAt) ?? new Date(),
        reportIdProvider: normalized.providerReportId,
        bureaus: bureauCoverage,
        summaryJson: normalized.summary as unknown as Prisma.InputJsonValue,
        unmappedFieldsJson: (normalized.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        validationWarnings: normalized.validationWarnings,
      },
    });

    for (const p of normalized.profiles) {
      await tx.creditPersonalProfile.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(p.bureau),
          fullName: p.fullName,
          encryptedDob: p.dob ? encrypt(p.dob) : null,
          encryptedSsnLast4: p.ssnLast4 ? encrypt(p.ssnLast4) : null,
          encryptedPrimaryAddr: p.addressLine1 ? encrypt(p.addressLine1) : null,
          cityMasked: p.city,
          stateCode: p.stateCode,
          zipMasked: p.zip,
          phoneMasked: p.phone,
          employers: (p.employers ?? null) as unknown as Prisma.InputJsonValue,
          priorAddresses: (p.priorAddresses ?? null) as unknown as Prisma.InputJsonValue,
          aliases: p.aliases ?? [],
          fraudAlerts: (p.fraudAlerts ?? null) as unknown as Prisma.InputJsonValue,
          consumerStatement: p.consumerStatement,
          unmappedFieldsJson: (p.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const t of normalized.tradelines) {
      await tx.creditTradeline.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(t.bureau),
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
          openedAt: toDate(t.openedAt),
          closedAt: toDate(t.closedAt),
          lastReportedAt: toDate(t.lastReportedAt),
          lastActivityAt: toDate(t.lastActivityAt),
          lastPaymentAt: toDate(t.lastPaymentAt),
          isCollection: !!t.isCollection,
          isChargeOff: !!t.isChargeOff,
          isMedical: !!t.isMedical,
          isDerogatory: !!t.isDerogatory,
          isClosed: !!t.isClosed,
          isFraudClaimed: !!t.isFraudClaimed,
          paymentHistoryJson: (t.paymentHistory ?? null) as unknown as Prisma.InputJsonValue,
          remarks: t.remarks ?? [],
          unmappedFieldsJson: (t.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const q of normalized.inquiries) {
      await tx.creditInquiry.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(q.bureau),
          inquirerName: q.inquirerName,
          inquirerType: q.inquirerType,
          inquiryDate: toDate(q.inquiryDate),
          isHard: q.isHard !== false,
          purpose: q.purpose,
          unmappedFieldsJson: (q.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const c of normalized.collections) {
      await tx.creditCollection.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(c.bureau),
          collectorName: c.collectorName,
          originalCreditor: c.originalCreditor,
          accountRefMasked: c.accountRefMasked,
          balanceCents: c.balanceCents,
          originalBalanceCents: c.originalBalanceCents,
          statusLabel: c.statusLabel,
          assignedAt: toDate(c.assignedAt),
          reportedAt: toDate(c.reportedAt),
          firstDelinquencyAt: toDate(c.firstDelinquencyAt),
          isMedical: !!c.isMedical,
          unmappedFieldsJson: (c.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const r of normalized.publicRecords) {
      await tx.creditPublicRecord.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(r.bureau),
          recordType: r.recordType,
          status: r.status,
          courtName: r.courtName,
          referenceNumber: r.referenceNumber,
          filedAt: toDate(r.filedAt),
          resolvedAt: toDate(r.resolvedAt),
          amountCents: r.amountCents,
          unmappedFieldsJson: (r.unmapped ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const s of normalized.scores) {
      await tx.creditScoreSnapshot.create({
        data: {
          importId: imp.id,
          bureau: toCreditReportBureau(s.bureau),
          scoreModel: s.scoreModel,
          score: s.score,
          rangeMin: s.rangeMin,
          rangeMax: s.rangeMax,
          factors: s.factors ?? [],
          pulledAt: toDate(s.pulledAt),
        },
      });
    }

    // Link dispute candidates back to their tradeline, if any.
    const tradelinesByFingerprint = new Map<string, string>();
    const tradelineRows = await tx.creditTradeline.findMany({
      where: { importId: imp.id },
      select: { id: true, fingerprint: true, bureau: true },
    });
    for (const row of tradelineRows) {
      tradelinesByFingerprint.set(`${row.bureau}::${row.fingerprint}`, row.id);
    }

    for (const cand of candidates) {
      const key = cand.tradelineFingerprint
        ? `${toCreditReportBureau(cand.bureau)}::${cand.tradelineFingerprint}`
        : undefined;
      await tx.creditDisputeCandidate.create({
        data: {
          importId: imp.id,
          tradelineId: key ? tradelinesByFingerprint.get(key) ?? null : null,
          bureau: toCreditReportBureau(cand.bureau),
          stage: cand.stage,
          reason: cand.reason,
          reasonCodes: cand.reasonCodes,
          severity: cand.severity,
          summary: cand.summary,
          evidenceJson: cand.evidenceJson as unknown as Prisma.InputJsonValue,
          legalBasis: cand.legalBasis,
          confidence: cand.confidence,
        },
      });
    }

    await tx.creditReportImport.update({
      where: { id: imp.id },
      data: {
        status: "NORMALIZED" as CreditImportStatus,
        normalizedAt: new Date(),
        validatedAt: new Date(),
        parserVersion: RUNNER_VERSION,
        bureauCoverage,
        errorCode: null,
        errorMessage: null,
        errorDetailJson: {} as unknown as Prisma.InputJsonValue,
      },
    });
  });

  await writeAuditLog({
    targetUserId: imp.userId,
    actorUserId: opts.actorUserId,
    action: "CREDIT_IMPORT_NORMALIZED",
    entityType: "CreditReportImport",
    entityId: imp.id,
    metadataJson: {
      provider: imp.provider,
      bureausDetected: normalized.bureausDetected,
      tradelineCount: normalized.tradelines.length,
      inquiryCount: normalized.inquiries.length,
      collectionCount: normalized.collections.length,
      publicRecordCount: normalized.publicRecords.length,
      candidateCount: candidates.length,
      validationWarnings: normalized.validationWarnings,
    },
  });

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
