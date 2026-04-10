// Credit report parser — handles MyFreeScoreNow tri-merge PDFs, pasted text,
// and generic bureau report formats. Multi-strategy extraction:
//   1. Tri-merge columnar layout (MyFreeScore style: creditor row then EQ|EX|TU columns)
//   2. Labeled field blocks (Creditor: / Account #: / Balance: style)
//   3. Line-scan fallback (greedy pattern matching on individual lines)
//
// Design rules:
//   - Never drop data. Low-confidence rows are surfaced for manual review.
//   - Never invent fields. Missing = undefined, not guessed.
//   - Signal engine runs BEFORE AI, so rule-based findings always show even if AI fails.

export type ParsedTradeline = {
  bureau: "Experian" | "Equifax" | "TransUnion";
  creditorName: string;
  accountRefMasked: string;
  accountType?: string;
  balanceCents?: number;
  highBalanceCents?: number;
  creditLimitCents?: number;
  pastDueCents?: number;
  statusLabel?: string;
  openedAt?: Date;
  lastReportedAt?: Date;
  lastActivityAt?: Date;
  isCollection?: boolean;
  isMedical?: boolean;
  parseConfidence: "high" | "medium" | "low";
  signalSummary: string[];
};

export type ParseResult = {
  text: string;
  tradelines: ParsedTradeline[];
  bureauGuess?: ParsedTradeline["bureau"];
  reviewFlags: string[];
  accountCount: number;
  signalCount: number;
  bureausDetected: string[];
};

type Bureau = ParsedTradeline["bureau"];

const BUREAU_PATTERNS: Array<[RegExp, Bureau]> = [
  [/experian/i, "Experian"],
  [/equifax/i, "Equifax"],
  [/transunion|trans\s*union/i, "TransUnion"],
];

const BUREAU_SHORT: Record<string, Bureau> = {
  EQ: "Equifax",
  EX: "Experian",
  TU: "TransUnion",
  EQUIFAX: "Equifax",
  EXPERIAN: "Experian",
  TRANSUNION: "TransUnion",
};

// Known creditor / lender name patterns (ALL CAPS in MyFreeScore output)
const CREDITOR_PATTERN =
  /^([A-Z][A-Z0-9 .,'&\-/()]{2,})$/;

const ACCOUNT_TYPE_KEYWORDS: Record<string, string> = {
  "credit card": "Credit Card",
  "revolving": "Credit Card",
  "installment": "Installment Loan",
  "mortgage": "Mortgage",
  "student loan": "Student Loan",
  "auto loan": "Auto Loan",
  "collection": "Collection",
  "medical": "Medical",
  "charge off": "Charge-Off",
  "line of credit": "Line of Credit",
};

// ─── Utility ────────────────────────────────────────────────────────────────

function dollarsToCents(s: string): number | undefined {
  const m = s.replace(/[, ]/g, "").match(/\$?\s*(\d+)(?:\.(\d{1,2}))?/);
  if (!m) return undefined;
  return parseInt(m[1], 10) * 100 + (m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0);
}

function parseDate(s: string): Date | undefined {
  if (!s || s.length < 4) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function detectBureau(text: string): Bureau | undefined {
  for (const [re, name] of BUREAU_PATTERNS) if (re.test(text)) return name;
  return undefined;
}

function detectAllBureaus(text: string): Bureau[] {
  const found: Bureau[] = [];
  for (const [re, name] of BUREAU_PATTERNS) if (re.test(text)) found.push(name);
  return found;
}

function detectAccountType(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [kw, label] of Object.entries(ACCOUNT_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) return label;
  }
  return undefined;
}

// ─── Text preprocessing ─────────────────────────────────────────────────────

function preprocess(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\f/g, "\n") // form feeds
    .replace(/Page \d+ of \d+/gi, "") // page numbers
    .replace(/^\s*myfreescore.*$/gim, "") // repeated headers
    .replace(/^\s*credit report.*$/gim, "")
    .replace(/^\s*generated on.*$/gim, "")
    .replace(/^\s*report date.*$/gim, "")
    .replace(/[ \t]{3,}/g, "  ") // collapse big spaces to double
    .replace(/\n{3,}/g, "\n\n") // collapse triple+ newlines
    .trim();
}

// ─── Strategy 1: Tri-merge columnar (MyFreeScore style) ─────────────────────

function parseTriMergeColumnar(text: string): ParsedTradeline[] {
  const lines = text.split("\n");
  const out: ParsedTradeline[] = [];
  let currentCreditor: string | null = null;
  let currentBlock: string[] = [];

  function flushBlock() {
    if (!currentCreditor || currentBlock.length === 0) return;
    const blockText = currentBlock.join("\n");

    // Try to find bureau-specific data in the block
    const bureausInBlock = detectAllBureaus(blockText);
    const acctMatch = blockText.match(/(?:Account\s*(?:#|Number|No))\s*[:\-]?\s*([X*x\d\- ]{4,})/i)
      ?? blockText.match(/([X*x]{2,}\d{2,})/);
    const acctRef = acctMatch?.[1]?.replace(/\s+/g, "") ?? "••••";
    const accountType = detectAccountType(blockText);
    const isCollection = /collection/i.test(blockText);
    const isMedical = /medical/i.test(blockText);

    // Extract dollar amounts
    const balMatch = blockText.match(/(?:Balance|Current Balance|Bal)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const highMatch = blockText.match(/(?:High Balance|High Bal|Highest)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const limitMatch = blockText.match(/(?:Credit Limit|Limit)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const pastMatch = blockText.match(/(?:Past Due|Amount Past Due)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const statusMatch = blockText.match(/(?:Account Status|Status|Pay Status|Condition)\s*[:\-]\s*([A-Za-z /\-]+)/i);
    const openedMatch = blockText.match(/(?:Date Opened|Opened|Open Date)\s*[:\-]?\s*([\d/\-A-Za-z]+)/i);
    const reportedMatch = blockText.match(/(?:Last Reported|Date Reported|Reported)\s*[:\-]?\s*([\d/\-A-Za-z]+)/i);
    const activityMatch = blockText.match(/(?:Last Activity|Last Active|Last Payment)\s*[:\-]?\s*([\d/\-A-Za-z]+)/i);

    const fields = [balMatch, statusMatch, openedMatch, reportedMatch].filter(Boolean).length;
    const confidence: ParsedTradeline["parseConfidence"] =
      fields >= 3 ? "high" : fields >= 1 ? "medium" : "low";

    // Signals
    const signals: string[] = [];
    if (isCollection) signals.push("Collection account detected");
    if (isMedical) signals.push("Medical account detected");
    if (statusMatch?.[1] && /charge.?off/i.test(statusMatch[1])) signals.push("Charged-off account");
    if (pastMatch && dollarsToCents(pastMatch[1])! > 0) signals.push("Past-due balance reported");

    // If we detect multiple bureaus, create one tradeline per bureau
    const targetBureaus: Bureau[] = bureausInBlock.length > 0
      ? bureausInBlock
      : ["Experian"]; // fallback

    for (const bureau of targetBureaus) {
      out.push({
        bureau,
        creditorName: currentCreditor,
        accountRefMasked: acctRef,
        accountType,
        balanceCents: balMatch ? dollarsToCents(balMatch[1]) : undefined,
        highBalanceCents: highMatch ? dollarsToCents(highMatch[1]) : undefined,
        creditLimitCents: limitMatch ? dollarsToCents(limitMatch[1]) : undefined,
        pastDueCents: pastMatch ? dollarsToCents(pastMatch[1]) : undefined,
        statusLabel: statusMatch?.[1]?.trim(),
        openedAt: openedMatch ? parseDate(openedMatch[1]) : undefined,
        lastReportedAt: reportedMatch ? parseDate(reportedMatch[1]) : undefined,
        lastActivityAt: activityMatch ? parseDate(activityMatch[1]) : undefined,
        isCollection,
        isMedical,
        parseConfidence: confidence,
        signalSummary: [...signals],
      });
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Is this an ALL-CAPS creditor name? (new account block)
    if (CREDITOR_PATTERN.test(trimmed) && trimmed.length >= 3 && trimmed.length <= 60) {
      // Skip if it looks like a header/label rather than a creditor
      if (/^(ACCOUNT|BALANCE|STATUS|DATE|PAYMENT|CREDIT|PERSONAL|ADDRESS|INQUIRY)/i.test(trimmed)) continue;
      flushBlock();
      currentCreditor = trimmed;
      currentBlock = [];
    } else if (currentCreditor) {
      currentBlock.push(line);
    }
  }
  flushBlock();
  return out;
}

// ─── Strategy 2: Labeled field blocks (original approach) ────────────────────

function parseLabeledBlocks(text: string, defaultBureau: Bureau): ParsedTradeline[] {
  const out: ParsedTradeline[] = [];
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const creditorMatch = block.match(
      /(?:Creditor|Account Name|Furnisher|Company Name)\s*[:\-]\s*([A-Z0-9 .,'&\-/()]{3,})/i,
    );
    const acctMatch = block.match(
      /(?:Account\s*(?:#|Number|No))\s*[:\-]\s*([X*x\d\- ]{4,})/i,
    );
    if (!creditorMatch) continue;

    const acctRef = acctMatch?.[1]?.replace(/\s+/g, "") ?? "••••";
    const balMatch = block.match(/Balance\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const highMatch = block.match(/(?:High Balance|Highest)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const limitMatch = block.match(/(?:Credit Limit|Limit)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const pastMatch = block.match(/Past\s*Due\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const statusMatch = block.match(/(?:Account Status|Status|Pay Status)\s*[:\-]\s*([A-Za-z /\-]+)/i);
    const openedMatch = block.match(/(?:Date Opened|Opened)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);
    const reportedMatch = block.match(/(?:Last Reported|Date Reported)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);
    const activityMatch = block.match(/(?:Last Activity)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);

    const isCollection = /collection/i.test(block);
    const isMedical = /medical/i.test(block);
    const accountType = detectAccountType(block);
    const blockBureau = detectBureau(block) ?? defaultBureau;

    const fields = [balMatch, statusMatch, openedMatch, reportedMatch].filter(Boolean).length;
    const confidence: ParsedTradeline["parseConfidence"] =
      fields >= 3 ? "high" : fields >= 1 ? "medium" : "low";

    const signals: string[] = [];
    if (isCollection) signals.push("Collection account detected");
    if (isMedical) signals.push("Medical account detected");
    if (statusMatch?.[1] && /charge.?off/i.test(statusMatch[1])) signals.push("Charged-off account");
    if (pastMatch && dollarsToCents(pastMatch[1])! > 0) signals.push("Past-due balance reported");

    out.push({
      bureau: blockBureau,
      creditorName: creditorMatch[1].trim(),
      accountRefMasked: acctRef,
      accountType,
      balanceCents: balMatch ? dollarsToCents(balMatch[1]) : undefined,
      highBalanceCents: highMatch ? dollarsToCents(highMatch[1]) : undefined,
      creditLimitCents: limitMatch ? dollarsToCents(limitMatch[1]) : undefined,
      pastDueCents: pastMatch ? dollarsToCents(pastMatch[1]) : undefined,
      statusLabel: statusMatch?.[1]?.trim(),
      openedAt: openedMatch ? parseDate(openedMatch[1]) : undefined,
      lastReportedAt: reportedMatch ? parseDate(reportedMatch[1]) : undefined,
      lastActivityAt: activityMatch ? parseDate(activityMatch[1]) : undefined,
      isCollection,
      isMedical,
      parseConfidence: confidence,
      signalSummary: signals,
    });
  }
  return out;
}

// ─── Strategy 3: Line-scan fallback ──────────────────────────────────────────

function parseLineScan(text: string, defaultBureau: Bureau): ParsedTradeline[] {
  const out: ParsedTradeline[] = [];
  const dollarPattern = /\$\s*[\d,]+(?:\.\d{2})?/g;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Look for lines that have a creditor-like name AND a dollar amount
    if (CREDITOR_PATTERN.test(line)) continue; // handled by tri-merge strategy
    const dollars = line.match(dollarPattern);
    if (!dollars || dollars.length === 0) continue;
    // Check surrounding lines for creditor name
    let creditor: string | null = null;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const prev = lines[j].trim();
      if (CREDITOR_PATTERN.test(prev) && prev.length >= 3 && prev.length <= 60) {
        creditor = prev;
        break;
      }
    }
    if (!creditor) continue;

    const bal = dollarsToCents(dollars[0]);
    const isCollection = /collection/i.test(line);
    const signals: string[] = [];
    if (isCollection) signals.push("Collection account detected");

    out.push({
      bureau: defaultBureau,
      creditorName: creditor,
      accountRefMasked: "••••",
      balanceCents: bal,
      isCollection,
      isMedical: /medical/i.test(line),
      parseConfidence: "low",
      signalSummary: signals,
    });
  }
  return out;
}

// ─── Cross-tradeline signal engine ───────────────────────────────────────────

function addCrossSignals(tradelines: ParsedTradeline[]): void {
  // Group by normalized creditor + account
  const groups = new Map<string, ParsedTradeline[]>();
  for (const t of tradelines) {
    const key = `${t.creditorName.toLowerCase().replace(/\s+/g, "")}::${t.accountRefMasked}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  for (const [, rows] of groups) {
    if (rows.length > 1) {
      const balances = new Set(rows.map((r) => r.balanceCents ?? -1));
      if (balances.size > 1) {
        for (const r of rows) r.signalSummary.push("Balance mismatch between bureaus");
      }
      const statuses = new Set(rows.map((r) => r.statusLabel ?? ""));
      if (statuses.size > 1) {
        for (const r of rows) r.signalSummary.push("Status inconsistent across bureaus");
      }
    }
    // Duplicate detection within same bureau
    const byBureau = new Map<string, ParsedTradeline[]>();
    for (const r of rows) {
      if (!byBureau.has(r.bureau)) byBureau.set(r.bureau, []);
      byBureau.get(r.bureau)!.push(r);
    }
    for (const [, same] of byBureau) {
      if (same.length > 1) {
        for (const r of same) r.signalSummary.push("Account appears duplicated on this bureau");
      }
    }
  }

  // Check for missing bureau coverage
  const allBureaus = new Set(tradelines.map((t) => t.bureau));
  if (allBureaus.size > 1) {
    for (const [, rows] of groups) {
      const present = new Set(rows.map((r) => r.bureau));
      for (const b of allBureaus) {
        if (!present.has(b)) {
          for (const r of rows) {
            if (!r.signalSummary.includes("Missing bureau reporting")) {
              r.signalSummary.push("Missing bureau reporting");
            }
          }
        }
      }
    }
  }

  // Deduplicate signals per tradeline
  for (const t of tradelines) {
    t.signalSummary = [...new Set(t.signalSummary)];
  }
}

// ─── Main parse function (text) ──────────────────────────────────────────────

export function parseReportText(rawText: string): ParseResult {
  const text = preprocess(rawText);
  const reviewFlags: string[] = [];
  const bureausDetected = detectAllBureaus(text);

  if (!text.trim()) {
    reviewFlags.push("EMPTY_TEXT");
    return { text, tradelines: [], reviewFlags, accountCount: 0, signalCount: 0, bureausDetected: [] };
  }

  if (bureausDetected.length === 0) reviewFlags.push("BUREAU_NOT_IDENTIFIED");

  // Run all three strategies and keep the one with the most results
  const strategy1 = parseTriMergeColumnar(text);
  const strategy2 = parseLabeledBlocks(text, bureausDetected[0] ?? "Experian");
  const strategy3 = parseLineScan(text, bureausDetected[0] ?? "Experian");

  let tradelines: ParsedTradeline[];
  if (strategy1.length >= strategy2.length && strategy1.length >= strategy3.length) {
    tradelines = strategy1;
    if (strategy1.length === 0) reviewFlags.push("TRIMARGE_PARSE_EMPTY");
  } else if (strategy2.length >= strategy3.length) {
    tradelines = strategy2;
  } else {
    tradelines = strategy3;
    reviewFlags.push("USED_LINE_SCAN_FALLBACK");
  }

  // If best strategy found nothing, merge all results
  if (tradelines.length === 0) {
    tradelines = [...strategy1, ...strategy2, ...strategy3];
  }

  // Deduplicate by creditor+account+bureau
  const seen = new Set<string>();
  tradelines = tradelines.filter((t) => {
    const key = `${t.bureau}::${t.creditorName}::${t.accountRefMasked}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Run cross-tradeline signal engine
  addCrossSignals(tradelines);

  if (tradelines.length === 0 && text.length > 200) reviewFlags.push("NO_TRADELINES_DETECTED");
  if (tradelines.some((t) => t.parseConfidence === "low")) reviewFlags.push("LOW_CONFIDENCE_ROWS");

  const signalCount = tradelines.reduce((n, t) => n + t.signalSummary.length, 0);

  return {
    text,
    tradelines,
    bureauGuess: bureausDetected[0],
    reviewFlags,
    accountCount: tradelines.length,
    signalCount,
    bureausDetected,
  };
}

// ─── Main parse function (PDF buffer) ────────────────────────────────────────

export async function parseReportPdf(buf: Buffer): Promise<ParseResult> {
  let rawText = "";
  try {
    const mod: any = await (import("pdf-parse" as any) as Promise<any>).catch(() => null);
    if (mod) {
      const pdf = mod.default ?? mod;
      const result = await pdf(buf);
      rawText = String(result?.text ?? "");
    }
  } catch {
    // fall through with empty text
  }

  if (!rawText) {
    return {
      text: "",
      tradelines: [],
      bureauGuess: undefined,
      reviewFlags: ["PDF_TEXT_EXTRACTION_FAILED"],
      accountCount: 0,
      signalCount: 0,
      bureausDetected: [],
    };
  }

  return parseReportText(rawText);
}
