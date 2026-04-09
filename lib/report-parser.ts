// Heuristic credit-report parser. First-pass: extracts text from PDF, then walks
// it with regex heuristics to produce normalized tradelines. Marks parse confidence.
//
// This is intentionally conservative — when confidence is low we still surface
// the row so a human can review it. We never silently drop or rewrite data.
//
// Real bureau reports vary wildly. Treat the output as "needs user review".

export type ParsedTradeline = {
  bureau: "Experian" | "Equifax" | "TransUnion";
  creditorName: string;
  accountRefMasked: string;
  balanceCents?: number;
  pastDueCents?: number;
  statusLabel?: string;
  openedAt?: Date;
  lastReportedAt?: Date;
  lastActivityAt?: Date;
  isCollection?: boolean;
  isMedical?: boolean;
  parseConfidence: "high" | "medium" | "low";
};

export type ParseResult = {
  text: string;
  tradelines: ParsedTradeline[];
  bureauGuess?: ParsedTradeline["bureau"];
  reviewFlags: string[];
};

const BUREAU_PATTERNS: Array<[RegExp, ParsedTradeline["bureau"]]> = [
  [/experian/i, "Experian"],
  [/equifax/i, "Equifax"],
  [/transunion|trans union/i, "TransUnion"],
];

function detectBureau(text: string): ParsedTradeline["bureau"] | undefined {
  for (const [re, name] of BUREAU_PATTERNS) if (re.test(text)) return name;
  return undefined;
}

function dollarsToCents(s: string): number | undefined {
  const m = s.replace(/[, ]/g, "").match(/\$?(\d+)(?:\.(\d{1,2}))?/);
  if (!m) return undefined;
  const dollars = parseInt(m[1], 10);
  const cents = m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0;
  return dollars * 100 + cents;
}

function parseDate(s: string): Date | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

// Extracts blocks that look like a tradeline. Heuristic — designed to be safe,
// not exhaustive. Returns whatever it finds with a confidence flag.
function extractTradelinesFromText(text: string, bureau: ParsedTradeline["bureau"]): ParsedTradeline[] {
  const out: ParsedTradeline[] = [];
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const creditorMatch = block.match(/(?:Creditor|Account Name|Furnisher)\s*[:\-]\s*([A-Z0-9 .,'&\-]{3,})/i);
    const acctMatch = block.match(/(?:Account\s*#|Account Number)\s*[:\-]\s*([X*\d\- ]{4,})/i);
    if (!creditorMatch || !acctMatch) continue;

    const balMatch = block.match(/Balance\s*[:\-]?\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
    const pastMatch = block.match(/Past\s*Due\s*[:\-]?\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
    const statusMatch = block.match(/Status\s*[:\-]\s*([A-Za-z /]+)/i);
    const openedMatch = block.match(/(?:Date Opened|Opened)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);
    const reportedMatch = block.match(/(?:Last Reported|Date Reported)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);
    const activityMatch = block.match(/(?:Last Activity)\s*[:\-]\s*([\d/\-A-Za-z]+)/i);

    const isCollection = /collection/i.test(block);
    const isMedical = /medical/i.test(block);

    const fields = [balMatch, statusMatch, openedMatch, reportedMatch].filter(Boolean).length;
    const confidence: ParsedTradeline["parseConfidence"] =
      fields >= 3 ? "high" : fields >= 1 ? "medium" : "low";

    out.push({
      bureau,
      creditorName: creditorMatch[1].trim(),
      accountRefMasked: acctMatch[1].replace(/\s+/g, ""),
      balanceCents: balMatch ? dollarsToCents(balMatch[1]) : undefined,
      pastDueCents: pastMatch ? dollarsToCents(pastMatch[1]) : undefined,
      statusLabel: statusMatch?.[1].trim(),
      openedAt: openedMatch ? parseDate(openedMatch[1]) : undefined,
      lastReportedAt: reportedMatch ? parseDate(reportedMatch[1]) : undefined,
      lastActivityAt: activityMatch ? parseDate(activityMatch[1]) : undefined,
      isCollection,
      isMedical,
      parseConfidence: confidence,
    });
  }
  return out;
}

// Parse raw report text directly (for paste-text import).
// Same logic as the PDF pipeline but skips pdf-parse extraction.
export function parseReportText(text: string): ParseResult {
  const reviewFlags: string[] = [];
  if (!text.trim()) {
    reviewFlags.push("EMPTY_TEXT");
    return { text, tradelines: [], reviewFlags };
  }

  // Try to detect all three bureaus in a tri-merge paste
  const allBureaus: ParsedTradeline["bureau"][] = [];
  for (const [re, name] of BUREAU_PATTERNS) if (re.test(text)) allBureaus.push(name);

  if (allBureaus.length === 0) reviewFlags.push("BUREAU_NOT_IDENTIFIED");

  // For tri-merge reports, try splitting by bureau sections and parsing each
  let tradelines: ParsedTradeline[] = [];
  if (allBureaus.length > 1) {
    // Split text into bureau-labeled sections
    const sectionPattern = /(experian|equifax|transunion|trans union)/gi;
    const matches = [...text.matchAll(sectionPattern)];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const section = text.slice(start, end);
      const bureau = detectBureau(section);
      if (bureau) {
        tradelines.push(...extractTradelinesFromText(section, bureau));
      }
    }
  }

  // Fallback: treat entire text as one bureau section
  if (tradelines.length === 0) {
    const bureau = allBureaus[0] ?? "Experian";
    tradelines = extractTradelinesFromText(text, bureau);
  }

  if (tradelines.length === 0 && text.length > 200) reviewFlags.push("NO_TRADELINES_DETECTED");
  if (tradelines.some((t) => t.parseConfidence === "low")) reviewFlags.push("LOW_CONFIDENCE_ROWS");

  return { text, tradelines, bureauGuess: allBureaus[0], reviewFlags };
}

export async function parseReportPdf(buf: Buffer): Promise<ParseResult> {
  let text = "";
  try {
    // Lazy import — keeps cold start small and avoids breaking builds
    // when pdf-parse is not yet installed.
    const mod: any = await (import("pdf-parse" as any) as Promise<any>).catch(() => null);
    if (mod) {
      const pdf = mod.default ?? mod;
      const result = await pdf(buf);
      text = String(result?.text ?? "");
    }
  } catch {
    // fall through with empty text
  }

  const reviewFlags: string[] = [];
  if (!text) reviewFlags.push("PDF_TEXT_EXTRACTION_FAILED");

  const bureau = detectBureau(text);
  if (!bureau) reviewFlags.push("BUREAU_NOT_IDENTIFIED");

  const tradelines = bureau ? extractTradelinesFromText(text, bureau) : [];
  if (tradelines.length === 0 && text) reviewFlags.push("NO_TRADELINES_DETECTED");
  if (tradelines.some((t) => t.parseConfidence === "low")) reviewFlags.push("LOW_CONFIDENCE_ROWS");

  return { text, tradelines, bureauGuess: bureau, reviewFlags };
}
