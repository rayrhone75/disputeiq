// Minimal dependency-free PDF generator for dispute letters.
// Produces a single-or-multi-page text PDF using the built-in Helvetica font.
// Real PDF — not a placeholder. Output bytes are ready for LetterStream.
//
// Layout: US Letter (612x792 pt), 1" margins, 11pt body, ~52 chars/line, ~58 lines/page.

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 72;
const MARGIN_T = 720; // y from bottom for first line
const LINE_H = 14;
const FONT_SIZE = 11;
const MAX_LINES_PER_PAGE = 46;
const MAX_LINE_CHARS = 90;

export interface LetterPdfInput {
  senderBlock: string[]; // multi-line return address
  date: string; // formatted date string
  recipientBlock: string[]; // multi-line recipient address
  subject: string;
  body: string; // full body text — will be wrapped + paginated
  signatureName: string;
}

function wrapLine(line: string, max = MAX_LINE_CHARS): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  const words = line.split(/\s+/);
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= max) cur += " " + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function buildLines(input: LetterPdfInput): string[] {
  const lines: string[] = [];
  for (const l of input.senderBlock) lines.push(...wrapLine(l));
  lines.push("");
  lines.push(input.date);
  lines.push("");
  for (const l of input.recipientBlock) lines.push(...wrapLine(l));
  lines.push("");
  lines.push(`Re: ${input.subject}`);
  lines.push("");
  for (const para of input.body.split(/\n+/)) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    lines.push(...wrapLine(para.trim()));
    lines.push("");
  }
  lines.push("Sincerely,");
  lines.push("");
  lines.push("");
  lines.push(input.signatureName);
  return lines;
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function paginate(lines: string[]): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + MAX_LINES_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

function buildPageStream(lines: string[]): string {
  const parts: string[] = [];
  parts.push("BT");
  parts.push(`/F1 ${FONT_SIZE} Tf`);
  parts.push(`${LINE_H} TL`);
  parts.push(`${MARGIN_L} ${MARGIN_T} Td`);
  for (const ln of lines) {
    parts.push(`(${escapePdfText(ln)}) Tj`);
    parts.push("T*");
  }
  parts.push("ET");
  return parts.join("\n");
}

export interface BuiltLetterPdf {
  bytes: Buffer;
  pages: number;
}

export function buildLetterPdf(input: LetterPdfInput): BuiltLetterPdf {
  const allLines = buildLines(input);
  const pages = paginate(allLines);

  // PDF object plan:
  // 1: Catalog
  // 2: Pages
  // 3..(2+N): Page objects
  // (3+N)..(2+2N): Page contents streams
  // (3+2N): Font
  const N = pages.length;
  const pageObjStart = 3;
  const contentObjStart = 3 + N;
  const fontObj = 3 + 2 * N;

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const kids = Array.from({ length: N }, (_, i) => `${pageObjStart + i} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Count ${N} /Kids [${kids}] >>\nendobj\n`);

  for (let i = 0; i < N; i++) {
    objects.push(
      `${pageObjStart + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjStart + i} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj\n`,
    );
  }

  for (let i = 0; i < N; i++) {
    const stream = buildPageStream(pages[i]);
    objects.push(
      `${contentObjStart + i} 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }

  objects.push(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  );

  const header = "%PDF-1.4\n%\xff\xff\xff\xff\n";
  const chunks: Buffer[] = [Buffer.from(header, "binary")];
  const offsets: number[] = [];
  let cursor = chunks[0].length;
  for (const obj of objects) {
    offsets.push(cursor);
    const buf = Buffer.from(obj, "utf8");
    chunks.push(buf);
    cursor += buf.length;
  }

  const xrefStart = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "utf8"));

  return { bytes: Buffer.concat(chunks), pages: N };
}
