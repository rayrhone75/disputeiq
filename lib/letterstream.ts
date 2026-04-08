// LetterStream adapter — documented API spec.
//
// Endpoint: https://www.letterstream.com/apis/index.php (POST only)
// Auth fields on every request:
//   a = LETTERSTREAM_API_ID
//   t = unique numeric 10-18 digit timestamp/id
//   h = md5( base64_encode( last6(t) + LETTERSTREAM_API_KEY + first6(t) ) )
//
// Primary submit path: Method 1 batch ZIP upload (multipart, field "multi_file")
//   - ZIP contains: one CSV manifest + all referenced PDFs
//   - Unique CSV filename per batch
//   - MailType=certified for Certified Mail w/ Electronic Return Receipt
//
// Fallback: Method 2 single-file POST (multipart, field "single_file")
//
// Tracking:
//   - getinfo=trackx with responseformat=json
//   - getinfo=sig
//   - batchstatus / jobstatus
import crypto from "node:crypto";
import { storage } from "@/lib/storage";

const LS_ENDPOINT =
  process.env.LETTERSTREAM_API_BASE ?? "https://www.letterstream.com/apis/index.php";

export type LetterstreamMode = "test" | "production";

export interface LetterstreamRecipient {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface LetterstreamSender {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface LetterstreamSubmitInput {
  securePdfRef: string;
  recipient: LetterstreamRecipient;
  sender: LetterstreamSender;
  certified: boolean;
  err: boolean; // Electronic Return Receipt
  pages?: number;
  duplex?: boolean;
  color?: boolean;
  coversheet?: boolean;
  returnEnvelope?: boolean;
  metadata?: Record<string, string>;
}

export interface LetterstreamJob {
  jobId: string;
  status: "submitted" | "failed";
  mode: LetterstreamMode;
  securePdfRef: string;
  certified: boolean;
  err: boolean;
  metadata?: Record<string, string>;
  rawResponse?: unknown;
}

function currentMode(): LetterstreamMode {
  return (process.env.LETTERSTREAM_MODE ?? "test") as LetterstreamMode;
}

// --- auth ------------------------------------------------------------------

function newT(): string {
  // 16-digit numeric id: millis + 3 random digits. Well inside the 10–18 window.
  const ms = Date.now().toString();
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return ms + rand;
}

function authFields(): { a: string; t: string; h: string } {
  const a = process.env.LETTERSTREAM_API_ID ?? "";
  const key = process.env.LETTERSTREAM_API_KEY ?? "";
  const t = newT();
  const first6 = t.slice(0, 6);
  const last6 = t.slice(-6);
  const b64 = Buffer.from(last6 + key + first6, "utf8").toString("base64");
  const h = crypto.createHash("md5").update(b64).digest("hex");
  return { a, t, h };
}

// --- CSV -------------------------------------------------------------------

function csvEscape(v: string | number | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// LetterStream CSV manifest columns for the batch ZIP.
// Column set follows the documented Method 1 manifest: recipient + sender
// address block, mail type, duplex/color flags, page count, and the PDF
// filename inside the same ZIP that this row refers to.
const CSV_COLUMNS = [
  "UniqueID",
  "PDFFileName",
  "Pages",
  "MailType",
  "CoverSheet",
  "Duplex",
  "Ink",
  "Paper",
  "ReturnEnvelope",
  "Recipient_Name",
  "Recipient_Company",
  "Recipient_Addr1",
  "Recipient_Addr2",
  "Recipient_City",
  "Recipient_State",
  "Recipient_Zip",
  "Recipient_Country",
  "Sender_Name",
  "Sender_Company",
  "Sender_Addr1",
  "Sender_Addr2",
  "Sender_City",
  "Sender_State",
  "Sender_Zip",
];

interface ManifestRow {
  uniqueId: string;
  pdfFileName: string;
  pages: number;
  mailType: string; // "certified" | "first" | ...
  coverSheet: 0 | 1;
  duplex: 0 | 1;
  ink: "color" | "bw";
  paper: string;
  returnEnvelope: 0 | 1;
  recipient: LetterstreamRecipient;
  sender: LetterstreamSender;
}

function buildCsv(rows: ManifestRow[]): Buffer {
  const lines: string[] = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.uniqueId,
        r.pdfFileName,
        r.pages,
        r.mailType,
        r.coverSheet,
        r.duplex,
        r.ink,
        r.paper,
        r.returnEnvelope,
        r.recipient.name,
        r.recipient.company ?? "",
        r.recipient.address1,
        r.recipient.address2 ?? "",
        r.recipient.city,
        r.recipient.state,
        r.recipient.zip,
        r.recipient.country ?? "US",
        r.sender.name,
        r.sender.company ?? "",
        r.sender.address1,
        r.sender.address2 ?? "",
        r.sender.city,
        r.sender.state,
        r.sender.zip,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return Buffer.from(lines.join("\r\n") + "\r\n", "utf8");
}

// --- minimal store-mode ZIP ------------------------------------------------
// Produces a ZIP with no compression (method = 0). Good enough for small
// batches of PDFs and a CSV. Avoids adding a dependency.

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(0, 8); // method = store
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0, 12); // mod date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    localParts.push(lfh, nameBuf, e.data);

    // Central directory header
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0, 8); // flags
    cdh.writeUInt16LE(0, 10); // method
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra len
    cdh.writeUInt16LE(0, 32); // comment len
    cdh.writeUInt16LE(0, 34); // disk #
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE(0, 38); // external attrs
    cdh.writeUInt32LE(offset, 42);
    centralParts.push(cdh, nameBuf);

    offset += lfh.length + nameBuf.length + size;
  }

  const centralStart = offset;
  const central = Buffer.concat(centralParts);
  const centralSize = central.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

// --- HTTP submit -----------------------------------------------------------

async function postMultipart(form: FormData): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(LS_ENDPOINT, { method: "POST", body: form });
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* LetterStream may return non-JSON for some endpoints */
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e?.message ?? e) } };
  }
}

function attachAuth(form: FormData) {
  const { a, t, h } = authFields();
  form.append("a", a);
  form.append("t", t);
  form.append("h", h);
  return { a, t, h };
}

function mailTypeString(certified: boolean): string {
  return certified ? "certified" : "first";
}

// --- Method 1: batch ZIP upload -------------------------------------------

export interface BatchSubmitResult {
  batchId: string;
  status: "submitted" | "failed";
  rawResponse: unknown;
}

export async function submitBatchZip(
  inputs: (LetterstreamSubmitInput & { uniqueId: string; pdfBytes: Buffer; pages: number })[],
): Promise<BatchSubmitResult> {
  const batchStamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const csvName = `disputeiq_manifest_${batchStamp}.csv`;

  const zipEntries: ZipEntry[] = [];
  const rows: ManifestRow[] = [];

  for (const input of inputs) {
    const pdfName = `${input.uniqueId}.pdf`;
    zipEntries.push({ name: pdfName, data: input.pdfBytes });
    rows.push({
      uniqueId: input.uniqueId,
      pdfFileName: pdfName,
      pages: input.pages,
      mailType: mailTypeString(input.certified),
      coverSheet: input.coversheet ? 1 : 0,
      duplex: input.duplex ? 1 : 0,
      ink: input.color ? "color" : "bw",
      paper: "white24",
      returnEnvelope: input.returnEnvelope ? 1 : 0,
      recipient: input.recipient,
      sender: input.sender,
    });
  }

  const csvBuf = buildCsv(rows);
  zipEntries.unshift({ name: csvName, data: csvBuf });
  const zipBuf = buildZip(zipEntries);

  const form = new FormData();
  attachAuth(form);
  form.append("mode", currentMode());
  form.append(
    "multi_file",
    new Blob([new Uint8Array(zipBuf)], { type: "application/zip" }),
    `disputeiq_batch_${batchStamp}.zip`,
  );

  const res = await postMultipart(form);
  if (!res.ok) {
    console.warn("[letterstream] batch submit failed", { status: res.status, data: res.data });
    return { batchId: `ls_batch_pending_${batchStamp}`, status: "failed", rawResponse: res.data };
  }
  const batchId =
    res.data?.batch_id ?? res.data?.batchid ?? res.data?.BatchID ?? `ls_batch_${batchStamp}`;
  return { batchId: String(batchId), status: "submitted", rawResponse: res.data };
}

// --- Method 2: single-file POST (fallback/testing) -------------------------

async function submitSingleFile(
  input: LetterstreamSubmitInput,
  pdfBytes: Buffer,
  pages: number,
): Promise<LetterstreamJob> {
  const form = new FormData();
  attachAuth(form);
  form.append("mode", currentMode());
  form.append("job", `disputeiq_${Date.now()}`);

  // Sender block ("from") — LetterStream accepts a pipe/newline joined block.
  const fromBlock = [
    input.sender.name,
    input.sender.company ?? "",
    input.sender.address1,
    input.sender.address2 ?? "",
    `${input.sender.city}, ${input.sender.state} ${input.sender.zip}`,
  ]
    .filter(Boolean)
    .join("\n");
  form.append("from", fromBlock);

  // Recipient is a repeatable to[] field per docs.
  const toBlock = [
    input.recipient.name,
    input.recipient.company ?? "",
    input.recipient.address1,
    input.recipient.address2 ?? "",
    `${input.recipient.city}, ${input.recipient.state} ${input.recipient.zip}`,
    input.recipient.country ?? "US",
  ]
    .filter(Boolean)
    .join("\n");
  form.append("to[]", toBlock);

  form.append("pages", String(pages));
  form.append("mailtype", mailTypeString(input.certified));
  form.append("coversheet", input.coversheet ? "1" : "0");
  form.append("duplex", input.duplex ? "1" : "0");
  form.append("ink", input.color ? "color" : "bw");
  form.append("paper", "white24");
  form.append("returnenv", input.returnEnvelope ? "1" : "0");
  form.append(
    "single_file",
    new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
    `${Date.now()}.pdf`,
  );

  const res = await postMultipart(form);
  if (!res.ok) {
    return {
      jobId: `ls_pending_${Date.now()}`,
      status: "failed",
      mode: currentMode(),
      securePdfRef: input.securePdfRef,
      certified: input.certified,
      err: input.err,
      metadata: input.metadata,
      rawResponse: res.data,
    };
  }
  const jobId =
    res.data?.job_id ?? res.data?.jobid ?? res.data?.JobID ?? res.data?.id ?? `ls_${Date.now()}`;
  return {
    jobId: String(jobId),
    status: "submitted",
    mode: currentMode(),
    securePdfRef: input.securePdfRef,
    certified: input.certified,
    err: input.err,
    metadata: input.metadata,
    rawResponse: res.data,
  };
}

// --- Public submit entry point --------------------------------------------
//
// Fetches the PDF from secure storage, then submits using the documented
// Method 1 batch ZIP path by default (single-row batch for a single letter).
// Set LETTERSTREAM_SUBMIT_METHOD=single to use Method 2.

export async function sendLetterstreamJob(input: LetterstreamSubmitInput): Promise<LetterstreamJob> {
  const mode = currentMode();
  const apiId = process.env.LETTERSTREAM_API_ID;
  const apiKey = process.env.LETTERSTREAM_API_KEY;

  // Local-dev fallback: no creds means mock submit (preserves the dev loop).
  if (!apiId || !apiKey) {
    return {
      jobId: "ls_mock_" + Date.now(),
      status: "submitted",
      mode,
      securePdfRef: input.securePdfRef,
      certified: input.certified,
      err: input.err,
      metadata: input.metadata,
    };
  }

  let pdfBytes: Buffer;
  try {
    pdfBytes = await storage.get(input.securePdfRef);
  } catch (e: any) {
    console.warn("[letterstream] pdf fetch failed", { ref: input.securePdfRef, err: String(e?.message ?? e) });
    return {
      jobId: `ls_pending_${Date.now()}`,
      status: "failed",
      mode,
      securePdfRef: input.securePdfRef,
      certified: input.certified,
      err: input.err,
      metadata: input.metadata,
      rawResponse: { error: "pdf_fetch_failed" },
    };
  }

  const pages = input.pages ?? 1;
  const method = process.env.LETTERSTREAM_SUBMIT_METHOD ?? "batch";

  if (method === "single") {
    return submitSingleFile(input, pdfBytes, pages);
  }

  const uniqueId = (input.metadata?.mailJobId ?? input.metadata?.disputeCaseId ?? `ls_${Date.now()}`)
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const batch = await submitBatchZip([{ ...input, uniqueId, pdfBytes, pages }]);
  return {
    jobId: batch.batchId,
    status: batch.status,
    mode,
    securePdfRef: input.securePdfRef,
    certified: input.certified,
    err: input.err,
    metadata: input.metadata,
    rawResponse: batch.rawResponse,
  };
}

// --- Tracking / status helpers --------------------------------------------

async function getInfo(params: Record<string, string>): Promise<any> {
  const form = new FormData();
  attachAuth(form);
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  const res = await postMultipart(form);
  return res.data;
}

export function trackx(jobId: string) {
  return getInfo({ getinfo: "trackx", responseformat: "json", jobid: jobId });
}

export function getSignature(jobId: string) {
  return getInfo({ getinfo: "sig", jobid: jobId });
}

export function batchStatus(batchId: string) {
  return getInfo({ getinfo: "batchstatus", responseformat: "json", batchid: batchId });
}

export function jobStatus(jobId: string) {
  return getInfo({ getinfo: "jobstatus", responseformat: "json", jobid: jobId });
}
