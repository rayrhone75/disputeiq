// Runtime validation schemas for the credit-import pipeline.
//
// Two layers of validation:
//   1. API request shapes (admin creates an import, pastes JSON, etc).
//   2. The normalized report shape, used as a safety net before persistence.
//
// The normalization mapper itself tolerates malformed input — zod here is a
// last-line check that the mapper produced something sane, not the primary
// guard against bad provider data.

import { z } from "zod";

export const BureauKeyZ = z.enum(["EXPERIAN", "EQUIFAX", "TRANSUNION", "UNKNOWN"]);

export const CreditProviderZ = z.enum(["IDENTITYIQ", "MYSCOREIQ", "MYFREESCORENOW", "MANUAL"]);

// Looser than NormalizedReport but tight enough to catch obvious breakage.
export const NormalizedReportZ = z.object({
  schemaVersion: z.literal("v1"),
  provider: CreditProviderZ,
  pulledAt: z.string().min(1),
  providerReportId: z.string().optional(),
  bureausDetected: z.array(BureauKeyZ),
  profiles: z.array(z.object({
    bureau: BureauKeyZ,
    fullName: z.string().optional(),
    dob: z.string().optional(),
    ssnLast4: z.string().max(4).optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    stateCode: z.string().optional(),
    zip: z.string().optional(),
    phone: z.string().optional(),
    employers: z.any().optional(),
    priorAddresses: z.any().optional(),
    aliases: z.array(z.string()).optional(),
    fraudAlerts: z.any().optional(),
    consumerStatement: z.string().optional(),
    unmapped: z.record(z.unknown()).optional(),
  })),
  tradelines: z.array(z.object({
    bureau: BureauKeyZ,
    creditorName: z.string().min(1),
    accountRefMasked: z.string().min(1),
  }).passthrough()),
  inquiries: z.array(z.object({
    bureau: BureauKeyZ,
    inquirerName: z.string().min(1),
  }).passthrough()),
  collections: z.array(z.object({
    bureau: BureauKeyZ,
    collectorName: z.string().min(1),
    accountRefMasked: z.string().min(1),
  }).passthrough()),
  publicRecords: z.array(z.object({
    bureau: BureauKeyZ,
    recordType: z.string().min(1),
  }).passthrough()),
  scores: z.array(z.object({
    bureau: BureauKeyZ,
    scoreModel: z.string(),
    score: z.number().int(),
  }).passthrough()),
  summary: z.object({
    byBureau: z.record(BureauKeyZ, z.any()),
    derogatoryCount: z.number().int().nonnegative(),
    collectionsCount: z.number().int().nonnegative(),
    hardInquiriesCount: z.number().int().nonnegative(),
  }),
  unmapped: z.record(z.unknown()).optional(),
  validationWarnings: z.array(z.string()),
});

// ── API request shapes ──────────────────────────────────────────────────────

export const CreateImportZ = z.object({
  userId: z.string().min(1),
  provider: CreditProviderZ,
  sourceUrl: z.string().url().optional(),
  providerRef: z.string().max(200).optional(),
});

export const PasteImportZ = z.object({
  importId: z.string().min(1),
  // Either a raw string the admin pasted, or the parsed JSON value.
  bodyText: z.string().max(25 * 1024 * 1024).optional(),
  json: z.unknown().optional(),
}).refine((v) => v.bodyText || v.json !== undefined, {
  message: "Either bodyText or json must be provided",
});

export const FetchImportZ = z.object({
  importId: z.string().min(1),
  url: z.string().url(),
  cookieHeader: z.string().max(16_384).optional(),
  bearerToken: z.string().max(8_192).optional(),
});

export const RunNormalizationZ = z.object({
  importId: z.string().min(1),
  /** if set, drop & replace previously-normalized rows for this import */
  replace: z.boolean().default(true),
});

export const PreviewImportZ = z.object({
  provider: CreditProviderZ.default("IDENTITYIQ"),
  bodyText: z.string().optional(),
  json: z.unknown().optional(),
}).refine((v) => v.bodyText || v.json !== undefined, {
  message: "Either bodyText or json must be provided",
});

export type CreateImportInput = z.infer<typeof CreateImportZ>;
export type PasteImportInput = z.infer<typeof PasteImportZ>;
export type FetchImportInput = z.infer<typeof FetchImportZ>;
export type RunNormalizationInput = z.infer<typeof RunNormalizationZ>;
export type PreviewImportInput = z.infer<typeof PreviewImportZ>;
