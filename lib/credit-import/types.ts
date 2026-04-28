// Cross-provider type contract for credit-report ingestion.
//
// Goal: every provider adapter (IdentityIQ, MyScoreIQ, future ones) produces
// the same shape so the normalizer/mapper can be provider-agnostic. Raw JSON
// stays opaque until the adapter has a chance to classify it — the mapper
// only ever reads the normalized shape below.
//
// Any field the adapter cannot confidently produce is left undefined and
// captured under `unmapped` so we never silently drop data.

// Provider + bureau enums are string-literal unions that match the Convex
// schema (convex/schema.ts) exactly. Keeps adapters provider-agnostic
// without coupling to the database layer.
export type CreditProvider =
  | "IDENTITYIQ"
  | "MYSCOREIQ"
  | "MYFREESCORENOW"
  | "MANUAL";

export type CreditReportBureau =
  | "EXPERIAN"
  | "EQUIFAX"
  | "TRANSUNION"
  | "UNKNOWN";

export type BureauKey = "EXPERIAN" | "EQUIFAX" | "TRANSUNION" | "UNKNOWN";

export type RawProviderPayload = {
  provider: CreditProvider;
  /** optional provider report id */
  providerReportId?: string;
  /** ISO string representing when the report was pulled */
  pulledAt?: string;
  /** Sanitized/untouched JSON body as parsed from the provider */
  json: unknown;
  /** Source URL the JSON was fetched from (for audit) */
  sourceUrl?: string;
};

export type NormalizedPersonalProfile = {
  bureau: BureauKey;
  fullName?: string;
  dob?: string;            // ISO or free text — encryption happens at persistence
  ssnLast4?: string;
  addressLine1?: string;
  city?: string;
  stateCode?: string;
  zip?: string;
  phone?: string;
  employers?: Array<{ name?: string; position?: string; reportedAt?: string }>;
  priorAddresses?: Array<{
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
  aliases?: string[];
  fraudAlerts?: Array<{
    type?: string;
    postedAt?: string;
    expiresAt?: string;
    phone?: string;
  }>;
  consumerStatement?: string;
  unmapped?: Record<string, unknown>;
};

export type NormalizedTradeline = {
  bureau: BureauKey;
  creditorName: string;
  furnisherName?: string;
  accountRefMasked: string;
  accountType?: string;
  accountSubtype?: string;
  ownership?: string;
  balanceCents?: number;
  highBalanceCents?: number;
  creditLimitCents?: number;
  pastDueCents?: number;
  monthlyPaymentCents?: number;
  termsMonths?: number;
  statusLabel?: string;
  paymentStatus?: string;
  rawStatus?: string;
  openedAt?: string;
  closedAt?: string;
  lastReportedAt?: string;
  lastActivityAt?: string;
  lastPaymentAt?: string;
  isCollection?: boolean;
  isChargeOff?: boolean;
  isMedical?: boolean;
  isDerogatory?: boolean;
  isClosed?: boolean;
  isFraudClaimed?: boolean;
  paymentHistory?: Array<{ month: string; code: string }>;
  remarks?: string[];
  unmapped?: Record<string, unknown>;
};

export type NormalizedInquiry = {
  bureau: BureauKey;
  inquirerName: string;
  inquirerType?: string;
  inquiryDate?: string;
  isHard?: boolean;
  purpose?: string;
  unmapped?: Record<string, unknown>;
};

export type NormalizedCollection = {
  bureau: BureauKey;
  collectorName: string;
  originalCreditor?: string;
  accountRefMasked: string;
  balanceCents?: number;
  originalBalanceCents?: number;
  statusLabel?: string;
  assignedAt?: string;
  reportedAt?: string;
  firstDelinquencyAt?: string;
  isMedical?: boolean;
  unmapped?: Record<string, unknown>;
};

export type NormalizedPublicRecord = {
  bureau: BureauKey;
  recordType: string;
  status?: string;
  courtName?: string;
  referenceNumber?: string;
  filedAt?: string;
  resolvedAt?: string;
  amountCents?: number;
  unmapped?: Record<string, unknown>;
};

export type NormalizedScore = {
  bureau: BureauKey;
  scoreModel: string;
  score: number;
  rangeMin?: number;
  rangeMax?: number;
  factors?: string[];
  pulledAt?: string;
};

export type NormalizedReport = {
  schemaVersion: "v1";
  provider: CreditProvider;
  pulledAt: string;
  providerReportId?: string;
  bureausDetected: BureauKey[];
  profiles: NormalizedPersonalProfile[];
  tradelines: NormalizedTradeline[];
  inquiries: NormalizedInquiry[];
  collections: NormalizedCollection[];
  publicRecords: NormalizedPublicRecord[];
  scores: NormalizedScore[];
  summary: {
    byBureau: Record<
      BureauKey,
      {
        openAccounts?: number;
        totalBalanceCents?: number;
        totalPastDueCents?: number;
        totalInquiries?: number;
        totalCollections?: number;
      }
    >;
    derogatoryCount: number;
    collectionsCount: number;
    hardInquiriesCount: number;
  };
  unmapped?: Record<string, unknown>;
  validationWarnings: string[];
};

export interface CreditProviderAdapter {
  readonly provider: CreditProvider;
  /** Does this adapter claim this payload? Used for auto-detection. */
  matches(raw: unknown): boolean;
  /**
   * Transform the raw provider JSON into the normalized shape above.
   * Never throws on unexpected fields — everything unknown is preserved
   * under `unmapped`.
   */
  normalize(raw: unknown): NormalizedReport;
}

export type FetchOptions = {
  /** Fully-qualified URL to the provider's JSON endpoint. */
  url: string;
  /**
   * Browser-session cookies or bearer token.
   * IdentityIQ/MyScoreIQ expose the report through an authenticated web
   * session — callers pass the cookie jar they captured.
   */
  cookieHeader?: string;
  bearerToken?: string;
  userAgent?: string;
  /** Milliseconds — defaults to 30_000 */
  timeoutMs?: number;
  /** Abort signal for graceful cancellation */
  signal?: AbortSignal;
};

export type FetchResult = {
  status: number;
  contentType: string | null;
  bodyText: string;
  sizeBytes: number;
};

export const bureauFromString = (input?: string | null): BureauKey => {
  if (!input) return "UNKNOWN";
  const s = input.toString().trim().toUpperCase();
  if (s.includes("EQUIFAX") || s === "EQ" || s === "EFX") return "EQUIFAX";
  if (s.includes("EXPERIAN") || s === "EX" || s === "XPN") return "EXPERIAN";
  if (s.includes("TRANSUNION") || s.includes("TRANS UNION") || s === "TU" || s === "TUC")
    return "TRANSUNION";
  return "UNKNOWN";
};

export const toCreditReportBureau = (b: BureauKey): CreditReportBureau =>
  b as CreditReportBureau;
