// IdentityIQ / MyScoreIQ provider adapter.
//
// Both products are built on the same underlying platform and expose their
// report JSON at ".../CreditReport.aspx?view=json". The payload shape varies
// across tiers and report versions, so this adapter is written defensively:
//   - Every field is optional in the source.
//   - Fields the mapper doesn't recognize are preserved under `unmapped`.
//   - Unknown bureaus degrade to "UNKNOWN" rather than failing the import.
//
// The normalized output conforms to `NormalizedReport` in ../types.ts.

import type { CreditProvider } from "@prisma/client";
import {
  asArray,
  getPath,
  pickFirst,
  toBool,
  toCents,
  toInt,
  toIsoDate,
  toStr,
} from "../util";
import { maskAccount, maskPhone, maskSsnLast4, maskZip } from "../redact";
import {
  bureauFromString,
  type BureauKey,
  type CreditProviderAdapter,
  type NormalizedCollection,
  type NormalizedInquiry,
  type NormalizedPersonalProfile,
  type NormalizedPublicRecord,
  type NormalizedReport,
  type NormalizedScore,
  type NormalizedTradeline,
} from "../types";

// The fields we consume — everything else the payload contains survives in
// the raw capture and, per-entity, in `unmapped`.
const CONSUMED_TOP_LEVEL_KEYS = new Set<string>([
  "borrower",
  "consumer",
  "personalInformation",
  "personalinformation",
  "subject",
  "creditScore",
  "creditScores",
  "scores",
  "creditFile",
  "creditReport",
  "tradelines",
  "tradeLines",
  "accounts",
  "inquiries",
  "publicRecords",
  "publicrecord",
  "collections",
  "collectionAccounts",
  "bureaus",
  "reportMeta",
  "meta",
  "pulledAt",
  "pullDate",
  "reportDate",
  "reportId",
  "id",
]);

function leftover(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const nk = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!CONSUMED_TOP_LEVEL_KEYS.has(k) && !CONSUMED_TOP_LEVEL_KEYS.has(nk)) {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function bureauFrom(obj: unknown, fallback: BureauKey = "UNKNOWN"): BureauKey {
  const candidate =
    toStr(getPath(obj, ["bureau"])) ??
    toStr(getPath(obj, ["bureauName"])) ??
    toStr(getPath(obj, ["source"])) ??
    toStr(getPath(obj, ["agency"])) ??
    toStr(getPath(obj, ["repository"]));
  return bureauFromString(candidate) ?? fallback;
}

function normalizeProfile(src: unknown, bureau: BureauKey): NormalizedPersonalProfile {
  const joined = [
    toStr(getPath(src, ["firstName"])),
    toStr(getPath(src, ["middleName"])),
    toStr(getPath(src, ["lastName"])),
  ]
    .filter(Boolean)
    .join(" ");
  const name =
    toStr(getPath(src, ["fullName"])) ??
    toStr(getPath(src, ["name"])) ??
    (joined.length ? joined : undefined);

  const employersRaw = asArray(getPath(src, ["employers"])).concat(
    asArray(getPath(src, ["employment"])),
  );
  const priorAddresses = asArray(getPath(src, ["priorAddresses"])).concat(
    asArray(getPath(src, ["previousAddresses"])),
  );
  const fraudAlerts = asArray(getPath(src, ["fraudAlerts"])).concat(asArray(getPath(src, ["alerts"])));

  return {
    bureau,
    fullName: name,
    dob:
      toIsoDate(getPath(src, ["dob"])) ??
      toIsoDate(getPath(src, ["dateOfBirth"])) ??
      toIsoDate(getPath(src, ["birthDate"])),
    ssnLast4:
      maskSsnLast4(toStr(getPath(src, ["ssnLast4"])) ?? undefined) ??
      maskSsnLast4(toStr(getPath(src, ["ssn"])) ?? undefined) ??
      maskSsnLast4(toStr(getPath(src, ["socialSecurityNumber"])) ?? undefined),
    addressLine1:
      toStr(getPath(src, ["currentAddress", "line1"])) ??
      toStr(getPath(src, ["address", "line1"])) ??
      toStr(getPath(src, ["addressLine1"])) ??
      toStr(getPath(src, ["streetAddress"])),
    city:
      toStr(getPath(src, ["currentAddress", "city"])) ??
      toStr(getPath(src, ["address", "city"])) ??
      toStr(getPath(src, ["city"])),
    stateCode:
      toStr(getPath(src, ["currentAddress", "state"])) ??
      toStr(getPath(src, ["address", "state"])) ??
      toStr(getPath(src, ["state"])),
    zip: maskZip(
      toStr(getPath(src, ["currentAddress", "zip"])) ??
        toStr(getPath(src, ["address", "zip"])) ??
        toStr(getPath(src, ["zip"])) ??
        toStr(getPath(src, ["zipCode"])),
    ),
    phone: maskPhone(
      toStr(getPath(src, ["phone"])) ?? toStr(getPath(src, ["phoneNumber"])) ?? undefined,
    ),
    employers: employersRaw.length
      ? employersRaw.map((e) => ({
          name: toStr(getPath(e, ["name"])) ?? toStr(getPath(e, ["employer"])),
          position: toStr(getPath(e, ["position"])) ?? toStr(getPath(e, ["title"])),
          reportedAt: toIsoDate(getPath(e, ["reportedAt"])) ?? toIsoDate(getPath(e, ["dateReported"])),
        }))
      : undefined,
    priorAddresses: priorAddresses.length
      ? priorAddresses.map((a) => ({
          line1: toStr(getPath(a, ["line1"])) ?? toStr(getPath(a, ["street"])),
          city: toStr(getPath(a, ["city"])),
          state: toStr(getPath(a, ["state"])),
          zip: maskZip(toStr(getPath(a, ["zip"])) ?? undefined),
        }))
      : undefined,
    aliases: asArray<string>(getPath(src, ["aliases"]))
      .concat(asArray<string>(getPath(src, ["alsoKnownAs"])))
      .map((a) => (typeof a === "string" ? a : toStr(a) ?? ""))
      .filter(Boolean),
    fraudAlerts: fraudAlerts.length
      ? fraudAlerts.map((f) => ({
          type: toStr(getPath(f, ["type"])) ?? toStr(getPath(f, ["alertType"])),
          postedAt: toIsoDate(getPath(f, ["postedAt"])) ?? toIsoDate(getPath(f, ["date"])),
          expiresAt: toIsoDate(getPath(f, ["expiresAt"])) ?? toIsoDate(getPath(f, ["expirationDate"])),
          phone: maskPhone(toStr(getPath(f, ["phone"])) ?? undefined),
        }))
      : undefined,
    consumerStatement:
      toStr(getPath(src, ["consumerStatement"])) ??
      toStr(getPath(src, ["statement"])),
    unmapped: leftover(src),
  };
}

function normalizeTradeline(src: unknown, fallback: BureauKey): NormalizedTradeline {
  const creditor =
    toStr(getPath(src, ["creditorName"])) ??
    toStr(getPath(src, ["subscriberName"])) ??
    toStr(getPath(src, ["furnisherName"])) ??
    toStr(getPath(src, ["company"])) ??
    "UNKNOWN CREDITOR";

  const acctSrc =
    toStr(getPath(src, ["accountNumber"])) ??
    toStr(getPath(src, ["accountNumberDisplay"])) ??
    toStr(getPath(src, ["accountRef"])) ??
    toStr(getPath(src, ["acctNum"]));

  const paymentHistoryRaw = asArray(getPath(src, ["paymentHistory"])).concat(
    asArray(getPath(src, ["paymentPattern"])),
  );

  return {
    bureau: bureauFrom(src, fallback),
    creditorName: creditor,
    furnisherName: toStr(getPath(src, ["furnisherName"])),
    accountRefMasked: maskAccount(acctSrc),
    accountType: toStr(getPath(src, ["accountType"])) ?? toStr(getPath(src, ["type"])),
    accountSubtype: toStr(getPath(src, ["accountSubtype"])) ?? toStr(getPath(src, ["subtype"])),
    ownership:
      toStr(getPath(src, ["ownership"])) ??
      toStr(getPath(src, ["ecoa"])) ??
      toStr(getPath(src, ["accountCondition"])),
    balanceCents: toCents(
      pickFirst(getPath(src, ["balance"]), getPath(src, ["currentBalance"]), getPath(src, ["balanceAmount"])),
    ),
    highBalanceCents: toCents(
      pickFirst(getPath(src, ["highBalance"]), getPath(src, ["highestBalance"]), getPath(src, ["original"])),
    ),
    creditLimitCents: toCents(
      pickFirst(getPath(src, ["creditLimit"]), getPath(src, ["limit"])),
    ),
    pastDueCents: toCents(
      pickFirst(getPath(src, ["pastDue"]), getPath(src, ["amountPastDue"])),
    ),
    monthlyPaymentCents: toCents(getPath(src, ["monthlyPayment"])),
    termsMonths: toInt(getPath(src, ["termsMonths"])) ?? toInt(getPath(src, ["terms"])),
    statusLabel: toStr(getPath(src, ["status"])) ?? toStr(getPath(src, ["accountStatus"])),
    paymentStatus: toStr(getPath(src, ["paymentStatus"])) ?? toStr(getPath(src, ["payStatus"])),
    rawStatus: toStr(getPath(src, ["rawStatus"])) ?? toStr(getPath(src, ["statusRaw"])),
    openedAt: toIsoDate(getPath(src, ["dateOpened"])) ?? toIsoDate(getPath(src, ["openedAt"])),
    closedAt: toIsoDate(getPath(src, ["dateClosed"])) ?? toIsoDate(getPath(src, ["closedAt"])),
    lastReportedAt:
      toIsoDate(getPath(src, ["dateReported"])) ?? toIsoDate(getPath(src, ["lastReported"])),
    lastActivityAt:
      toIsoDate(getPath(src, ["lastActivity"])) ?? toIsoDate(getPath(src, ["lastActivityDate"])),
    lastPaymentAt:
      toIsoDate(getPath(src, ["lastPayment"])) ?? toIsoDate(getPath(src, ["datePaid"])),
    isCollection:
      toBool(getPath(src, ["isCollection"])) ??
      /collection/i.test(toStr(getPath(src, ["accountType"])) ?? "") ??
      /collection/i.test(toStr(getPath(src, ["status"])) ?? ""),
    isChargeOff:
      toBool(getPath(src, ["isChargeOff"])) ??
      /charge.?off/i.test(toStr(getPath(src, ["status"])) ?? ""),
    isMedical:
      toBool(getPath(src, ["isMedical"])) ??
      /medical/i.test(toStr(getPath(src, ["accountType"])) ?? "") ??
      /medical/i.test(toStr(getPath(src, ["creditorName"])) ?? ""),
    isDerogatory:
      toBool(getPath(src, ["isDerogatory"])) ??
      /derogatory|delinquent|past due|charge.?off|collection/i.test(
        toStr(getPath(src, ["status"])) ?? "",
      ),
    isClosed:
      toBool(getPath(src, ["isClosed"])) ??
      /closed/i.test(toStr(getPath(src, ["status"])) ?? ""),
    isFraudClaimed:
      toBool(getPath(src, ["isFraudClaimed"])) ??
      toBool(getPath(src, ["fraudIndicator"])),
    paymentHistory: paymentHistoryRaw.length
      ? paymentHistoryRaw
          .map((p) => ({
            month: toStr(getPath(p, ["month"])) ?? "",
            code: toStr(getPath(p, ["code"])) ?? toStr(getPath(p, ["status"])) ?? "",
          }))
          .filter((p) => p.month || p.code)
      : undefined,
    remarks: asArray<string>(getPath(src, ["remarks"]))
      .concat(asArray<string>(getPath(src, ["comments"])))
      .map((r) => (typeof r === "string" ? r : toStr(r) ?? ""))
      .filter(Boolean),
    unmapped: leftover(src),
  };
}

function normalizeInquiry(src: unknown, fallback: BureauKey): NormalizedInquiry {
  return {
    bureau: bureauFrom(src, fallback),
    inquirerName:
      toStr(getPath(src, ["inquirerName"])) ??
      toStr(getPath(src, ["subscriberName"])) ??
      toStr(getPath(src, ["company"])) ??
      "UNKNOWN",
    inquirerType: toStr(getPath(src, ["inquirerType"])) ?? toStr(getPath(src, ["type"])),
    inquiryDate: toIsoDate(getPath(src, ["inquiryDate"])) ?? toIsoDate(getPath(src, ["date"])),
    isHard: toBool(getPath(src, ["isHard"])) ?? toBool(getPath(src, ["hardInquiry"])) ?? true,
    purpose: toStr(getPath(src, ["purpose"])),
    unmapped: leftover(src),
  };
}

function normalizeCollection(src: unknown, fallback: BureauKey): NormalizedCollection {
  const acct = toStr(getPath(src, ["accountNumber"])) ?? toStr(getPath(src, ["accountRef"]));
  return {
    bureau: bureauFrom(src, fallback),
    collectorName:
      toStr(getPath(src, ["collectorName"])) ??
      toStr(getPath(src, ["subscriberName"])) ??
      toStr(getPath(src, ["creditorName"])) ??
      "UNKNOWN",
    originalCreditor:
      toStr(getPath(src, ["originalCreditor"])) ?? toStr(getPath(src, ["originalCreditorName"])),
    accountRefMasked: maskAccount(acct),
    balanceCents: toCents(pickFirst(getPath(src, ["balance"]), getPath(src, ["currentBalance"]))),
    originalBalanceCents: toCents(getPath(src, ["originalBalance"])),
    statusLabel: toStr(getPath(src, ["status"])),
    assignedAt: toIsoDate(getPath(src, ["dateAssigned"])) ?? toIsoDate(getPath(src, ["assignedAt"])),
    reportedAt: toIsoDate(getPath(src, ["dateReported"])) ?? toIsoDate(getPath(src, ["reportedAt"])),
    firstDelinquencyAt:
      toIsoDate(getPath(src, ["firstDelinquency"])) ??
      toIsoDate(getPath(src, ["dateOfFirstDelinquency"])),
    isMedical:
      toBool(getPath(src, ["isMedical"])) ??
      /medical/i.test(toStr(getPath(src, ["collectorName"])) ?? ""),
    unmapped: leftover(src),
  };
}

function normalizePublicRecord(src: unknown, fallback: BureauKey): NormalizedPublicRecord {
  return {
    bureau: bureauFrom(src, fallback),
    recordType:
      toStr(getPath(src, ["recordType"])) ??
      toStr(getPath(src, ["type"])) ??
      toStr(getPath(src, ["kind"])) ??
      "UNKNOWN",
    status: toStr(getPath(src, ["status"])),
    courtName: toStr(getPath(src, ["courtName"])) ?? toStr(getPath(src, ["court"])),
    referenceNumber: toStr(getPath(src, ["referenceNumber"])) ?? toStr(getPath(src, ["caseNumber"])),
    filedAt: toIsoDate(getPath(src, ["dateFiled"])) ?? toIsoDate(getPath(src, ["filedAt"])),
    resolvedAt: toIsoDate(getPath(src, ["dateResolved"])) ?? toIsoDate(getPath(src, ["resolvedAt"])),
    amountCents: toCents(getPath(src, ["amount"])),
    unmapped: leftover(src),
  };
}

function normalizeScore(src: unknown, fallback: BureauKey): NormalizedScore {
  return {
    bureau: bureauFrom(src, fallback),
    scoreModel: toStr(getPath(src, ["model"])) ?? toStr(getPath(src, ["scoreModel"])) ?? "Unknown",
    score: toInt(getPath(src, ["score"])) ?? toInt(getPath(src, ["value"])) ?? 0,
    rangeMin: toInt(getPath(src, ["rangeMin"])) ?? toInt(getPath(src, ["min"])),
    rangeMax: toInt(getPath(src, ["rangeMax"])) ?? toInt(getPath(src, ["max"])),
    factors: asArray<string>(getPath(src, ["factors"]))
      .concat(asArray<string>(getPath(src, ["reasons"])))
      .map((f) => (typeof f === "string" ? f : toStr(f) ?? ""))
      .filter(Boolean),
    pulledAt: toIsoDate(getPath(src, ["pulledAt"])) ?? toIsoDate(getPath(src, ["date"])),
  };
}

function collectBureaus(items: Array<{ bureau: BureauKey }>): BureauKey[] {
  const set = new Set<BureauKey>();
  for (const i of items) if (i.bureau !== "UNKNOWN") set.add(i.bureau);
  return [...set];
}

/** Concrete adapter class. */
class IdentityIqAdapter implements CreditProviderAdapter {
  constructor(readonly provider: CreditProvider) {}

  matches(raw: unknown): boolean {
    if (!raw || typeof raw !== "object") return false;
    const keys = Object.keys(raw as Record<string, unknown>).map((k) =>
      k.toLowerCase(),
    );
    // Heuristic signatures IdentityIQ/MyScoreIQ payloads tend to expose.
    const strongHints = ["creditfile", "creditreport", "subject", "borrower"];
    return strongHints.some((h) => keys.includes(h));
  }

  normalize(raw: unknown): NormalizedReport {
    const warnings: string[] = [];
    if (!raw || typeof raw !== "object") {
      warnings.push("RAW_NOT_OBJECT");
      return emptyReport(this.provider, warnings);
    }

    const profilesSrc = asArray(
      getPath(raw, ["personalInformation"]) ??
        getPath(raw, ["borrower"]) ??
        getPath(raw, ["subject"]),
    );
    const profiles = profilesSrc.length
      ? profilesSrc.map((p) => normalizeProfile(p, bureauFrom(p, "UNKNOWN")))
      : [];

    // Tradelines may live in any of several locations.
    const tradelinesSrc = asArray(
      getPath(raw, ["tradelines"]) ??
        getPath(raw, ["tradeLines"]) ??
        getPath(raw, ["accounts"]) ??
        getPath(raw, ["creditFile", "tradelines"]) ??
        getPath(raw, ["creditReport", "tradelines"]),
    );
    const tradelines = tradelinesSrc.map((t) => normalizeTradeline(t, "UNKNOWN"));

    const inquiriesSrc = asArray(
      getPath(raw, ["inquiries"]) ?? getPath(raw, ["creditFile", "inquiries"]),
    );
    const inquiries = inquiriesSrc.map((i) => normalizeInquiry(i, "UNKNOWN"));

    const collectionsSrc = asArray(
      getPath(raw, ["collections"]) ??
        getPath(raw, ["collectionAccounts"]) ??
        getPath(raw, ["creditFile", "collections"]),
    );
    const collections = collectionsSrc.map((c) => normalizeCollection(c, "UNKNOWN"));

    const publicRecordsSrc = asArray(
      getPath(raw, ["publicRecords"]) ??
        getPath(raw, ["publicrecord"]) ??
        getPath(raw, ["creditFile", "publicRecords"]),
    );
    const publicRecords = publicRecordsSrc.map((p) => normalizePublicRecord(p, "UNKNOWN"));

    const scoresSrc = asArray(
      getPath(raw, ["creditScores"]) ??
        getPath(raw, ["scores"]) ??
        getPath(raw, ["creditScore"]),
    );
    const scores = scoresSrc
      .map((s) => normalizeScore(s, "UNKNOWN"))
      .filter((s) => s.score > 0);

    const bureausDetected = [
      ...new Set<BureauKey>([
        ...collectBureaus(profiles),
        ...collectBureaus(tradelines),
        ...collectBureaus(inquiries),
        ...collectBureaus(collections),
        ...collectBureaus(publicRecords),
        ...collectBureaus(scores),
      ]),
    ];

    if (!tradelines.length && !collections.length && !publicRecords.length) {
      warnings.push("NO_ACCOUNTS_DETECTED");
    }
    if (!bureausDetected.length) warnings.push("BUREAU_NOT_IDENTIFIED");

    return {
      schemaVersion: "v1",
      provider: this.provider,
      pulledAt:
        toIsoDate(getPath(raw, ["pulledAt"])) ??
        toIsoDate(getPath(raw, ["pullDate"])) ??
        toIsoDate(getPath(raw, ["reportDate"])) ??
        new Date().toISOString(),
      providerReportId:
        toStr(getPath(raw, ["reportId"])) ??
        toStr(getPath(raw, ["id"])) ??
        toStr(getPath(raw, ["creditFile", "reportId"])),
      bureausDetected,
      profiles,
      tradelines,
      inquiries,
      collections,
      publicRecords,
      scores,
      summary: buildSummary({ tradelines, inquiries, collections }),
      unmapped: leftover(raw),
      validationWarnings: warnings,
    };
  }
}

function emptyReport(provider: CreditProvider, warnings: string[]): NormalizedReport {
  return {
    schemaVersion: "v1",
    provider,
    pulledAt: new Date().toISOString(),
    bureausDetected: [],
    profiles: [],
    tradelines: [],
    inquiries: [],
    collections: [],
    publicRecords: [],
    scores: [],
    summary: {
      byBureau: {
        EXPERIAN: {},
        EQUIFAX: {},
        TRANSUNION: {},
        UNKNOWN: {},
      },
      derogatoryCount: 0,
      collectionsCount: 0,
      hardInquiriesCount: 0,
    },
    validationWarnings: warnings,
  };
}

function buildSummary(input: {
  tradelines: NormalizedTradeline[];
  inquiries: NormalizedInquiry[];
  collections: NormalizedCollection[];
}) {
  const byBureau: NormalizedReport["summary"]["byBureau"] = {
    EXPERIAN: {},
    EQUIFAX: {},
    TRANSUNION: {},
    UNKNOWN: {},
  };
  const ensure = (b: BureauKey) => (byBureau[b] ?? (byBureau[b] = {}));
  for (const t of input.tradelines) {
    const row = ensure(t.bureau);
    if (!t.isClosed) row.openAccounts = (row.openAccounts ?? 0) + 1;
    if (typeof t.balanceCents === "number") row.totalBalanceCents = (row.totalBalanceCents ?? 0) + t.balanceCents;
    if (typeof t.pastDueCents === "number") row.totalPastDueCents = (row.totalPastDueCents ?? 0) + t.pastDueCents;
  }
  for (const q of input.inquiries) {
    const row = ensure(q.bureau);
    row.totalInquiries = (row.totalInquiries ?? 0) + 1;
  }
  for (const c of input.collections) {
    const row = ensure(c.bureau);
    row.totalCollections = (row.totalCollections ?? 0) + 1;
  }
  const derog = input.tradelines.filter((t) => t.isDerogatory || t.isChargeOff || t.isCollection).length;
  return {
    byBureau,
    derogatoryCount: derog,
    collectionsCount: input.collections.length,
    hardInquiriesCount: input.inquiries.filter((i) => i.isHard !== false).length,
  };
}

export const identityIqAdapter: CreditProviderAdapter = new IdentityIqAdapter("IDENTITYIQ" as CreditProvider);
export const myScoreIqAdapter: CreditProviderAdapter = new IdentityIqAdapter("MYSCOREIQ" as CreditProvider);
