// Regex overrides for paralegal output.
//
// VH learned in production that LLMs hallucinate structured tables with
// dates and amounts (credit_dispute_ai.py:1486-1509). The fix: after
// the paralegal returns, regex-extract the inquiry and collection
// sections directly from the source text and overlay them. AI keeps
// narrative-style fields; regex wins on numeric/date columns.
//
// Two extractors, both safe-by-default (return []) when the section
// header isn't found.

import type { VhParalegalJson } from "./ai-paralegal";

type Bureau = "Equifax" | "Experian" | "TransUnion";

type RegexInquiry = {
  creditor: string;
  date: string;
  type: string;
  bureau: Bureau;
};

type RegexCollection = {
  bureau: Bureau;
  collector?: string;
  date_reported?: string;
  date_assigned?: string;
  original_amount?: string;
  balance?: string;
  status_date?: string;
  balance_date?: string;
  purge_date?: string;
  account_number?: string;
  designator?: string;
};

const BUREAUS: Bureau[] = ["Equifax", "Experian", "TransUnion"];

// Match the dedicated "# 9. Inquiries" section (also bare "# Inquiries").
// VH uses ^#\s*(?:9\.\s*)?Inquiries\s*$ ... up to ^#\s*(?:10\.|11\.)\s.
// JS regex needs `m` for ^/$, and `s` for `.` to span lines.
function findInquiriesSection(text: string): string | null {
  const re = /^#\s*(?:9\.\s*)?Inquiries\s*$([\s\S]*?)(?=^#\s*(?:10\.|11\.)\s|\Z)/m;
  const m = text.match(re);
  return m ? m[0] : null;
}

function findCollectionsSection(text: string): string | null {
  const re = /^#\s*(?:11\.\s*)?Collections\s*$([\s\S]*?)(?=^#\s*(?:12\.)\s|\Z)/m;
  const m = text.match(re);
  return m ? m[0] : null;
}

export function extractInquiriesRegex(reportText: string): RegexInquiry[] {
  const section = findInquiriesSection(reportText);
  if (!section) return [];
  const inquiries: RegexInquiry[] = [];

  for (const bureau of BUREAUS) {
    // Look for a per-bureau heading and a Date|Company|Address table.
    const bureauRe = new RegExp(
      `(?:^|\\n)##?\\s*${bureau}\\s*\\n` +
        `(?:\\s*\\n)*` +
        `\\|\\s*Date\\s*\\|\\s*Company\\s*\\|\\s*Address\\s*\\|\\s*\\n` +
        `\\|[\\s\\-|]+\\|\\s*\\n` +
        `((?:\\|[^\\n]+\\n)*)`,
      "gm",
    );
    let m: RegExpExecArray | null;
    while ((m = bureauRe.exec(section)) !== null) {
      const rows = m[1].trim().split("\n");
      for (const row of rows) {
        const cols = row
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        if (cols.length >= 2 && cols[0] !== "---" && cols[0] !== "Date") {
          inquiries.push({
            creditor: cols[1] ?? "N/A",
            date: cols[0],
            type: "Hard",
            bureau,
          });
        }
      }
    }
  }
  return inquiries;
}

export function extractCollectionsRegex(reportText: string): RegexCollection[] {
  const section = findCollectionsSection(reportText);
  if (!section) return [];
  const collections: RegexCollection[] = [];

  // Split section by bureau heading.
  const parts = section.split(/(?:^|\n)#\s*(Equifax|Experian|TransUnion)\s*\n/);
  // parts[0] is preamble; pairs of (bureauName, content) follow.
  for (let i = 1; i < parts.length - 1; i += 2) {
    const bureau = parts[i] as Bureau;
    const content = parts[i + 1];

    // Split per collection entry on "Date Reported:".
    const entries = content.split(/Date Reported:\s*/);
    for (let e = 1; e < entries.length; e++) {
      const part = entries[e];
      const coll: RegexCollection = { bureau };

      const dateMatch = part.match(/(\w+ \d+, \d+)/);
      if (dateMatch) coll.date_reported = dateMatch[1];

      const clientMatch = part.match(/Agency Client:\s*(.+?)(?:\n|$)/);
      if (clientMatch) coll.collector = clientMatch[1].trim();

      const tableFields: Array<[string, keyof RegexCollection]> = [
        ["Date Assigned", "date_assigned"],
        ["Original Amount Owed", "original_amount"],
        ["Amount", "balance"],
        ["Status Date", "status_date"],
        ["Balance Date", "balance_date"],
        ["Purge Date", "purge_date"],
        ["Account Number", "account_number"],
        ["Account Designator Code", "designator"],
      ];
      for (const [label, key] of tableFields) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Table form: |  Label  |  value  |
        const tableMatch = part.match(
          new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*(.+?)\\s*\\|`),
        );
        if (tableMatch) {
          const val = tableMatch[1].trim();
          if (val && val !== "N/A") {
            (coll[key] as string | undefined) = val;
            continue;
          }
        }
        // Plain-text fallback: "Label value\n".
        const plainMatch = part.match(new RegExp(`${escaped}\\s+(.+?)(?:\\n|$)`));
        if (plainMatch) {
          const val = plainMatch[1].trim();
          if (val && val !== "N/A") {
            (coll[key] as string | undefined) = val;
          }
        }
      }

      if (coll.collector) collections.push(coll);
    }
  }

  return collections;
}

// Apply regex extractions back onto the paralegal JSON in-place. Inquiries
// are fully replaced when regex found any; collections merge field-by-
// field, with regex overriding null/undefined AI fields.
export function applyRegexOverrides(
  parsed: VhParalegalJson,
  reportText: string,
): VhParalegalJson {
  const regexInquiries = extractInquiriesRegex(reportText);
  if (regexInquiries.length > 0) {
    parsed.inquiries = regexInquiries.map((i) => ({
      creditor: i.creditor,
      date: i.date,
      type: i.type,
      bureau: i.bureau,
    }));
  }

  const regexCollections = extractCollectionsRegex(reportText);
  if (regexCollections.length > 0) {
    parsed.collections = parsed.collections ?? [];
    const existingByCollector = new Map<string, (typeof parsed.collections)[number]>();
    for (const c of parsed.collections) {
      const key = String(c.collector ?? "").toUpperCase();
      if (key) existingByCollector.set(key, c);
    }
    for (const rc of regexCollections) {
      const key = String(rc.collector ?? "").toUpperCase();
      if (!key) continue;
      const existing = existingByCollector.get(key);
      if (existing) {
        for (const [k, v] of Object.entries(rc)) {
          if (v == null || v === "N/A") continue;
          // Only overwrite if AI had no value (so AI narrative wins where it filled in).
          const currentVal = (existing as Record<string, unknown>)[k];
          if (currentVal == null || currentVal === "" || currentVal === "N/A") {
            (existing as Record<string, unknown>)[k] = v;
          }
        }
      } else {
        parsed.collections.push(rc);
        existingByCollector.set(key, rc);
      }
    }
  }

  return parsed;
}
