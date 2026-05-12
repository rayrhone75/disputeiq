// HTML → markdown for the paralegal LLM.
//
// Two strategies:
//   1. MyFreeScoreNow / MFSN-style report HTML — recognized by specific
//      DOM IDs that follow `…-{bureau-prefix}` conventions
//      (`efx`/`exp`/`tu`). We extract bureau scores, primary name, per-
//      bureau account category tables, inquiries grouped by bureau,
//      and creditor-contacts → collections.
//   2. Generic fallback — preserve block-level structure. Drop
//      <script>, <style>, <noscript>; insert newlines between block
//      tags so per-row table data stays line-aligned.
//
// Port of VH `extract_html` + `_extract_mfsn_html` + helpers
// (api_server.py:327-537).

export type ExtractHtmlResult = {
  markdown: string;
  source: "mfsn" | "generic";
};

export function extractHtml(html: string): ExtractHtmlResult {
  // Strong signals that this is a MyFreeScoreNow / IdentityIQ DOM.
  const mfsnSignal =
    html.includes("credit-report-main-container") ||
    (html.includes("MuiTableCell") && html.includes("inquiry-contact-name")) ||
    /id="personal-info-section-primary-name-(efx|exp|tu)"/i.test(html);

  if (mfsnSignal) {
    try {
      return { markdown: extractMfsnHtml(html), source: "mfsn" };
    } catch {
      // Fall through to generic.
    }
  }
  return { markdown: extractGenericHtml(html), source: "generic" };
}

// ── MFSN structured extractor ─────────────────────────────────────────

function extractMfsnHtml(html: string): string {
  const sections: string[] = [];

  // Scores
  const scoreMatches = Array.from(html.matchAll(/font-size="32"[^>]*>(\d{3})/g))
    .map((m) => m[1])
    .filter((s) => {
      const n = Number(s);
      return n >= 300 && n <= 850;
    });
  const labelMatches = Array.from(
    html.matchAll(/font-size="16"[^>]*font-style="italic">([A-Za-z\s]+)/g),
  ).map((m) => m[1].trim());
  const bureaus = ["Equifax", "Experian", "TransUnion"];
  for (let i = 0; i < bureaus.length; i++) {
    const score = i < scoreMatches.length ? scoreMatches[i] : "N/A";
    const label = i < labelMatches.length ? labelMatches[i] : "N/A";
    sections.push(`### ${bureaus[i]}\n## **${score}**\n### ${label}`);
  }

  // Personal Info
  const name = pickBest([
    firstById(html, "personal-info-section-primary-name-efx"),
    firstById(html, "personal-info-section-primary-name-exp"),
    firstById(html, "personal-info-section-primary-name-tu"),
  ]);
  const ssn = pickBest([
    firstById(html, "personal-info-section-ssn-efx"),
    firstById(html, "personal-info-section-ssn-exp"),
    firstById(html, "personal-info-section-ssn-tu"),
  ]);
  const address = pickBest([
    firstById(html, "personal-info-section-residence-efx"),
    firstById(html, "personal-info-section-residence-exp"),
    firstById(html, "personal-info-section-residence-tu"),
  ]);
  sections.push(
    `Consumer's Primary Name: ${name}\nReported SSN: ${ssn}\nCurrent Address: ${address}`,
  );

  // Account Summary
  const bureauConfigs: Array<{ name: string; prefix: "efx" | "exp" | "tu" }> = [
    { name: "Equifax", prefix: "efx" },
    { name: "Experian", prefix: "exp" },
    { name: "TransUnion", prefix: "tu" },
  ];
  for (const cfg of bureauConfigs) {
    const p = cfg.prefix;
    const total = firstById(
      html,
      p === "efx" ? `${p}-totalaccount` : `${p}-total-accounts`,
    );
    const pos = firstById(html, `${p}-positive-accounts`);
    const neg = firstById(
      html,
      `${p}-${p === "efx" ? "negetive" : "negative"}-accounts`,
    );
    sections.push(
      `**${cfg.name} Summary** Total: ${total} | Positive: ${pos} | Negative: ${neg}`,
    );
  }

  // Tradelines per category
  const categories: Array<[string, string]> = [
    ["positive-accounts-open", "Positive Open"],
    ["positive-accounts-closed", "Positive Closed"],
    ["positive-accounts-mixed", "Positive Mixed"],
    ["negative-accounts-open", "Negative Open"],
    ["negative-accounts-closed", "Negative Closed"],
    ["negative-accounts-mixed", "Negative Mixed"],
  ];
  for (const [catPrefix, catLabel] of categories) {
    const efxNames = extractByIdAll(html, `${catPrefix}-accountName-efx`);
    const expNames = extractByIdAll(html, `${catPrefix}-accountName-exp`);
    let tuNames = extractByIdAll(html, `${catPrefix}-accountName-tu`);
    if (tuNames.length === 0) {
      tuNames = extractByIdAll(html, `${catPrefix}-accountName-yu`);
    }
    const efxNums = extractByIdAll(html, `${catPrefix}-accountNumber-efx`);
    const expNums = extractByIdAll(html, `${catPrefix}-accountNumber-exp`);
    const tuNums = extractByIdAll(html, `${catPrefix}-accountNumber-tu`);
    const efxTypes = extractByIdAll(html, `${catPrefix}-accountType-efx`);
    const expTypes = extractByIdAll(html, `${catPrefix}-accountType-exp`);
    const tuTypes = extractByIdAll(html, `${catPrefix}-accountType-tu`);
    const efxCond = extractByIdAll(html, `${catPrefix}-accountCondition-efx`);
    const expCond = extractByIdAll(html, `${catPrefix}-accountCondition-exp`);
    const tuCond = extractByIdAll(html, `${catPrefix}-accountCondition-tu`);

    const count = Math.max(efxNames.length, expNames.length, tuNames.length);
    if (count === 0) continue;

    const acctLines: string[] = [`\n=== ${catLabel} Accounts ===`];
    for (let i = 0; i < count; i++) {
      const nameVal = pickBest([
        i < efxNames.length ? efxNames[i] : "N/A",
        i < expNames.length ? expNames[i] : "N/A",
        i < tuNames.length ? tuNames[i] : "N/A",
      ]);
      const acctType = pickBest([
        i < efxTypes.length ? efxTypes[i] : "N/A",
        i < expTypes.length ? expTypes[i] : "N/A",
        i < tuTypes.length ? tuTypes[i] : "N/A",
      ]);
      const efxC = i < efxCond.length ? efxCond[i] : "--";
      const expC = i < expCond.length ? expCond[i] : "--";
      const tuC = i < tuCond.length ? tuCond[i] : "--";
      const efxN = i < efxNums.length ? efxNums[i] : "--";
      const expN = i < expNums.length ? expNums[i] : "--";
      const tuN = i < tuNums.length ? tuNums[i] : "--";

      acctLines.push(`\n### ${nameVal}`);
      acctLines.push(`| | Equifax | Experian | TransUnion |`);
      acctLines.push(`|---|---|---|---|`);
      acctLines.push(`| Account # | ${efxN} | ${expN} | ${tuN} |`);
      acctLines.push(`| Account Type | ${acctType} | ${acctType} | ${acctType} |`);
      acctLines.push(`| Condition | ${efxC} | ${expC} | ${tuC} |`);
    }
    sections.push(acctLines.join("\n"));
  }

  // Inquiries (grouped per bureau by section boundary).
  const inqAllNames = extractByIdAll(html, "inquiry-contact-name");
  if (inqAllNames.length > 0) {
    const inqLines: string[] = ["\n=== INQUIRIES ==="];
    const bureauSections: Array<[string, string]> = [
      ["Equifax", "efx-inquiries"],
      ["Experian", "exp-inquiries"],
      ["TransUnion", "tu-inquiries"],
    ];
    for (const [bureauName, sectionId] of bureauSections) {
      const sectionStart = html.indexOf(`id="${sectionId}"`);
      if (sectionStart === -1) continue;
      const nextStarts = bureauSections
        .filter(([, sid]) => sid !== sectionId)
        .map(([, sid]) => html.indexOf(`id="${sid}"`, sectionStart + 1))
        .filter((p) => p > 0);
      const sectionEnd = nextStarts.length ? Math.min(...nextStarts) : html.length;
      const sectionHtml = html.slice(sectionStart, sectionEnd);

      const secNames = extractByIdAll(sectionHtml, "inquiry-contact-name");
      const secDates = extractByIdAll(sectionHtml, "inquiry-reported-date");
      const secTypes = extractByIdAll(sectionHtml, "inquiry-type");
      if (secNames.length === 0) continue;

      inqLines.push(`\n=== INQUIRIES: ${bureauName.toUpperCase()} ===`);
      for (let j = 0; j < secNames.length; j++) {
        const iType = j < secTypes.length ? secTypes[j] : "N/A";
        const iDate = j < secDates.length ? secDates[j] : "N/A";
        inqLines.push(`${iType} | ${secNames[j]} | ${iDate}`);
      }
    }
    sections.push(inqLines.join("\n"));
  }

  // Collections (from creditor-contacts where industry contains "collection").
  const industryTypes = extractByIdAll(html, "creditor-contacts-industry-type");
  const collNames = extractByIdAll(html, "creditor-contacts-creditor-name");
  if (industryTypes.length > 0) {
    const collLines: string[] = ["\n=== COLLECTIONS ==="];
    for (let i = 0; i < industryTypes.length; i++) {
      const industry = industryTypes[i];
      if (industry.toLowerCase().includes("collection")) {
        const collName = i < collNames.length ? collNames[i] : "Unknown";
        collLines.push(`Collection: ${collName} | Industry: ${industry}`);
      }
    }
    if (collLines.length > 1) sections.push(collLines.join("\n"));
  }

  return sections.join("\n\n");
}

// ── Generic structure-preserving stripper ─────────────────────────────

function extractGenericHtml(html: string): string {
  let out = html;
  // Drop script/style/noscript blocks entirely.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, " ");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, " ");
  out = out.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  out = out.replace(/<!--[\s\S]*?-->/g, " ");
  // Insert newlines around block-level elements so rows / cells stay
  // on their own lines for the paralegal to reason about.
  out = out.replace(
    /<\/(?:p|div|section|article|header|footer|tr|li|h[1-6]|table|tbody|thead)>/gi,
    "\n",
  );
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/td>|<\/th>/gi, " | ");
  // Strip remaining tags.
  out = out.replace(/<[^>]+>/g, " ");
  // Decode the handful of entities that show up frequently in saved
  // pages. Don't pull in a full entity decoder — the LLM tolerates
  // residual entities fine.
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  // Whitespace normalize but keep newlines (they preserve row breaks).
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// ── Helpers (port of VH _extract_by_id, _first_by_id, _pick_best) ─────

function extractByIdAll(html: string, elementId: string): string[] {
  // VH regex (api_server.py:350): id="..." + greedy capture up to </td or </div.
  const escaped = elementId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `id="${escaped}"[^>]*>([^<]*(?:<(?!/td|/div)[^<]*)*?)(?:</td|</div)`,
    "gi",
  );
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let val = m[1].replace(/<[^>]*>/g, " ").trim();
    val = val.replace(/\s+/g, " ");
    if (val === "--" || val === "-" || val === "") val = "N/A";
    results.push(val);
  }
  return results;
}

function firstById(html: string, elementId: string): string {
  const results = extractByIdAll(html, elementId);
  return results.length > 0 ? results[0] : "N/A";
}

function pickBest(vals: string[]): string {
  const valid = vals.filter((v) => v !== "N/A");
  if (valid.length === 0) return "N/A";
  return valid.reduce((a, b) => (b.length > a.length ? b : a));
}
