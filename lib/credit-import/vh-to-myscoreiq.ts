// Adapter: VH-shape paralegal JSON → MyScoreIQParsedJson.
//
// The existing identityIqAdapter (lib/credit-import/providers/identityiq.ts)
// already maps MyScoreIQParsedJson into the canonical NormalizedReport
// the dispute engine consumes. We keep that adapter intact and emit
// JSON in its expected shape from our paralegal output, so all the
// downstream Convex + dispute-candidate logic stays unchanged.
//
// Per-bureau expansion: VH `accounts[].balances` is `{equifax, experian,
// transunion}` (per-bureau dict). MyScoreIQ tradelines are flat per-row.
// We emit one tradeline row per bureau that has any signal on that
// account (balance, payment_status, etc.).

import { toCents, toIsoDate, toStr } from "./util";
import type {
  MyScoreIQParsedJson,
  MyScoreIQParseResult,
} from "./myscoreiq-text";
import type { VhParalegalJson } from "./ai-paralegal";

type Bureau = "Experian" | "Equifax" | "TransUnion";
const ALL_BUREAUS: Bureau[] = ["Equifax", "Experian", "TransUnion"];

const BUREAU_KEY_MAP: Record<Bureau, "equifax" | "experian" | "transunion"> = {
  Equifax: "equifax",
  Experian: "experian",
  TransUnion: "transunion",
};

function asBureau(v: unknown): Bureau | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase().replace(/[\s_-]+/g, "");
  if (s.startsWith("eq") || s === "efx") return "Equifax";
  if (s.startsWith("ex") || s === "exp") return "Experian";
  if (s.startsWith("tu") || s === "transunion") return "TransUnion";
  return undefined;
}

function cleanString(v: unknown): string | undefined {
  const s = toStr(v);
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed || trimmed === "N/A" || trimmed === "--" || trimmed === "-") return undefined;
  return trimmed;
}

function moneyToNumber(v: unknown): number | undefined {
  const cents = toCents(v);
  if (cents == null) return undefined;
  return cents / 100;
}

function isCollectionAccount(account: Record<string, unknown>): boolean {
  const flags = [
    account.account_type,
    account.status,
    account.payment_status,
  ];
  for (const flag of flags) {
    if (!flag) continue;
    if (typeof flag === "object") {
      for (const v of Object.values(flag)) {
        if (typeof v === "string" && /collection/i.test(v)) return true;
      }
      continue;
    }
    if (typeof flag === "string" && /collection/i.test(flag)) return true;
  }
  return false;
}

function isMedical(account: Record<string, unknown>): boolean {
  const fields = [account.creditor, account.account_type, account.comments];
  for (const f of fields) {
    if (typeof f === "string" && /medical|hospital|clinic/i.test(f)) return true;
  }
  return false;
}

function isChargeOff(account: Record<string, unknown>): boolean {
  const flags = [account.status, account.payment_status, account.comments];
  for (const f of flags) {
    if (!f) continue;
    if (typeof f === "object") {
      for (const v of Object.values(f)) {
        if (typeof v === "string" && /charge[\s-]?off/i.test(v)) return true;
      }
      continue;
    }
    if (typeof f === "string" && /charge[\s-]?off/i.test(f)) return true;
  }
  return false;
}

function isClosed(account: Record<string, unknown>): boolean {
  const status = cleanString(account.status);
  if (status && /closed|paid|settled/i.test(status)) return true;
  return false;
}

function isDerogatory(account: Record<string, unknown>): boolean {
  return (
    isCollectionAccount(account) ||
    isChargeOff(account) ||
    /derog|delinquen|late|past\s*due/i.test(
      String(account.status ?? "") + String(account.payment_status ?? ""),
    )
  );
}

export function vhParalegalToMyScoreIQ(
  parsed: VhParalegalJson,
): MyScoreIQParseResult {
  const reasonCodes: string[] = [];
  const tradelines: NonNullable<MyScoreIQParsedJson["tradelines"]> = [];
  const inquiries: NonNullable<MyScoreIQParsedJson["inquiries"]> = [];
  const collections: NonNullable<MyScoreIQParsedJson["collections"]> = [];
  const publicRecords: NonNullable<MyScoreIQParsedJson["publicRecords"]> = [];

  // ── Tradelines: per-bureau expansion ──────────────────────────────
  for (const acct of parsed.accounts ?? []) {
    const creditorName = cleanString(acct.creditor);
    if (!creditorName) continue;

    const accountNumber = cleanString(acct.account_number);
    const accountType = cleanString(acct.account_type);
    const dateOpened = toIsoDate(cleanString(acct.date_opened));
    const dateReported = toIsoDate(cleanString(acct.date_reported));
    const highBalance = moneyToNumber(acct.high_credit);
    const creditLimit = moneyToNumber(acct.credit_limit);
    const remarks = cleanString(acct.comments)
      ? [cleanString(acct.comments) as string]
      : undefined;

    const balances = (acct.balances ?? {}) as Record<string, unknown>;
    const paymentStatuses = (acct.payment_status ?? {}) as Record<string, unknown>;

    const baseFlags = {
      isCollection: isCollectionAccount(acct as Record<string, unknown>),
      isChargeOff: isChargeOff(acct as Record<string, unknown>),
      isMedical: isMedical(acct as Record<string, unknown>),
      isDerogatory: isDerogatory(acct as Record<string, unknown>),
      isClosed: isClosed(acct as Record<string, unknown>),
    };

    let emittedAny = false;
    for (const bureau of ALL_BUREAUS) {
      const k = BUREAU_KEY_MAP[bureau];
      const balanceRaw = balances[k];
      const payStatusRaw = paymentStatuses[k];
      const balance = moneyToNumber(balanceRaw);
      const status = cleanString(payStatusRaw) ?? cleanString(acct.status);

      // Skip bureaus with no signal at all.
      if (balance == null && !status && !accountNumber && !dateOpened && !dateReported) {
        continue;
      }
      emittedAny = true;
      tradelines.push({
        bureau,
        creditorName,
        accountNumber,
        accountType,
        balance,
        highBalance,
        creditLimit,
        status,
        dateOpened,
        lastReported: dateReported,
        remarks,
        ...baseFlags,
      });
    }

    // If neither bureau dict had a value but we still have a creditor row,
    // emit a single fallback tradeline using top-level status/balance.
    if (!emittedAny) {
      const fallbackBureau = asBureau(acct.status) ?? "Experian";
      tradelines.push({
        bureau: fallbackBureau,
        creditorName,
        accountNumber,
        accountType,
        status: cleanString(acct.status),
        dateOpened,
        lastReported: dateReported,
        highBalance,
        creditLimit,
        remarks,
        ...baseFlags,
      });
    }
  }

  // ── Inquiries ────────────────────────────────────────────────────
  for (const inq of parsed.inquiries ?? []) {
    const subscriberName = cleanString(inq.creditor);
    if (!subscriberName) continue;
    const bureau = asBureau(inq.bureau);
    if (!bureau) continue;
    const typeStr = cleanString(inq.type);
    inquiries.push({
      bureau,
      subscriberName,
      inquiryDate: toIsoDate(cleanString(inq.date)),
      hardInquiry: typeStr ? /hard/i.test(typeStr) : true,
      type: typeStr,
    });
  }

  // ── Collections ──────────────────────────────────────────────────
  for (const coll of parsed.collections ?? []) {
    const collectorName = cleanString(coll.collector);
    if (!collectorName) continue;
    const bureausRaw = (coll.bureaus_reporting ?? []) as unknown[];
    const bureaus: Bureau[] = [];
    for (const b of bureausRaw) {
      const m = asBureau(b);
      if (m && !bureaus.includes(m)) bureaus.push(m);
    }
    if (bureaus.length === 0) {
      const single = asBureau(coll.bureau);
      if (single) bureaus.push(single);
    }
    if (bureaus.length === 0) bureaus.push("Experian"); // last-ditch fallback

    const originalCreditor = cleanString(coll.original_creditor);
    const accountNumber = cleanString(coll.account_number);
    const balance = moneyToNumber(coll.balance);
    const originalBalance = moneyToNumber(coll.original_amount);
    const dateAssigned = toIsoDate(cleanString(coll.date_assigned));
    const dateReported = toIsoDate(cleanString(coll.date_reported));
    const status = cleanString(coll.status);
    const isMedicalColl = /medical|hospital|clinic/i.test(
      `${collectorName} ${originalCreditor ?? ""}`,
    );

    for (const bureau of bureaus) {
      collections.push({
        bureau,
        collectorName,
        originalCreditor,
        accountNumber,
        balance,
        originalBalance,
        status,
        dateAssigned,
        dateReported,
        isMedical: isMedicalColl,
      });
    }
  }

  // ── Public records ───────────────────────────────────────────────
  for (const pr of parsed.public_records ?? []) {
    const recordType = cleanString(pr.type);
    if (!recordType) continue;
    const bureau = asBureau(pr.bureau) ?? "Experian";
    publicRecords.push({
      bureau,
      recordType,
      status: cleanString(pr.status),
      courtName: cleanString(pr.court),
      dateFiled: toIsoDate(cleanString(pr.date_filed)),
      amount: moneyToNumber(pr.amount),
    });
  }

  // ── Borrower / personal info ─────────────────────────────────────
  const consumer = parsed.consumer ?? {};
  const addresses = Array.isArray(consumer.addresses) ? consumer.addresses : [];
  const firstAddress = addresses[0];
  const borrower: NonNullable<MyScoreIQParsedJson["borrower"]> = {
    fullName: cleanString(consumer.name),
    dateOfBirth: cleanString(consumer.dob),
    ssn: cleanString(consumer.ssn_last_4),
    currentAddress: firstAddress ? { line1: firstAddress } : undefined,
    priorAddresses:
      addresses.length > 1
        ? addresses.slice(1).map((a) => ({ line1: a }))
        : undefined,
  };

  const json: MyScoreIQParsedJson = {
    borrower,
    tradelines: tradelines.length ? tradelines : undefined,
    inquiries: inquiries.length ? inquiries : undefined,
    collections: collections.length ? collections : undefined,
    publicRecords: publicRecords.length ? publicRecords : undefined,
  };

  // Preserve anything we didn't map. The IdentityIQ adapter's leftover()
  // helper will pick this up so admins can see what we dropped.
  (json as Record<string, unknown>).unmappedSource = {
    consumer_statements: parsed.consumer_statements,
  };

  const counts = {
    tradelines: tradelines.length,
    inquiries: inquiries.length,
    collections: collections.length,
    publicRecords: publicRecords.length,
    scores: 0, // Paralegal doesn't currently extract scores in normalized form.
  };

  if (counts.tradelines === 0) reasonCodes.push("NO_TRADELINES_PARSED");
  if (counts.scores === 0) reasonCodes.push("NO_SCORES_PARSED");
  if (!borrower.fullName) reasonCodes.push("NO_BORROWER_NAME");

  // Confidence model: align with parseMyScoreIQText so the existing
  // runJsonPipeline confidence branch behaves the same way.
  let confidence: "high" | "medium" | "low";
  if (counts.tradelines >= 3 && borrower.fullName) {
    confidence = "high";
  } else if (counts.tradelines > 0) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { json, confidence, reasonCodes, counts };
}
