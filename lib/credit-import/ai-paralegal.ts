// AI paralegal: cleaned report text → structured JSON.
//
// Port of VH `_paralegal_extract` (credit_dispute_ai.py:1411-1520).
// Uses Mistral chat completions with the paralegal_v1 system prompt;
// the schema is intentionally identical to VH so downstream
// regex-override and adapter modules can be ported directly.
//
// `response_format: { type: "json_object" }` + temperature 0 + a
// strictly-typed zod schema makes this deterministic. On
// JSON.parse / schema failure we retry once with a "JSON only, no
// prose" suffix appended to the user message before giving up.

import crypto from "node:crypto";
import { z } from "zod";

const MISTRAL_API_BASE = "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-large-latest";

export class ParalegalExtractionError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Paralegal extraction failed (${status}): ${body.slice(0, 500)}`);
    this.name = "ParalegalExtractionError";
    this.status = status;
    this.body = body;
  }
}

// System prompt — verbatim port of VH/backend/prompts/paralegal_v1.txt
// minus the `/no_think` Qwen directive (irrelevant for Mistral).
const PARALEGAL_V1_PROMPT = `You are a paralegal at a consumer rights law firm. Your job is to extract ALL structured data from a raw credit report into clean JSON.

IMPORTANT: Do NOT include any reasoning or explanation. Output ONLY valid JSON — nothing else.

Be EXHAUSTIVE — do not skip any account, collection, inquiry, or public record. Extract every detail exactly as it appears.

Return JSON in this exact format:
{
  "consumer": {
    "name": "...",
    "ssn_last_4": "...",
    "dob": "...",
    "addresses": ["..."]
  },
  "accounts": [
    {
      "creditor": "...",
      "account_number": "...",
      "account_type": "...",
      "status": "...",
      "date_opened": "...",
      "date_reported": "...",
      "balances": {
        "equifax": "...",
        "experian": "...",
        "transunion": "..."
      },
      "payment_status": {
        "equifax": "...",
        "experian": "...",
        "transunion": "..."
      },
      "high_credit": "...",
      "credit_limit": "...",
      "payment_history": "...",
      "comments": "...",
      "dispute_status": "..."
    }
  ],
  "collections": [
    {
      "collector": "...",
      "original_creditor": "...",
      "account_number": "...",
      "balance": "...",
      "date_opened": "...",
      "date_reported": "...",
      "status": "...",
      "bureaus_reporting": ["..."]
    }
  ],
  "inquiries": [
    {
      "creditor": "...",
      "date": "...",
      "type": "hard or soft",
      "bureau": "...",
      "has_matching_account": false
    }
  ],
  "public_records": [
    {
      "type": "...",
      "court": "...",
      "date_filed": "...",
      "status": "...",
      "amount": "..."
    }
  ]
}

For each inquiry, check if there's a matching account with that creditor. Set has_matching_account accordingly.
If a field is not present in the report, use null. Do NOT invent data.`;

// Schema — loose-by-design. The paralegal is allowed to omit fields and
// to fill nulls; downstream code copes. The shape mirrors the prompt.
const StringishField = z.union([z.string(), z.number(), z.null()]).optional();

const PerBureauField = z
  .object({
    equifax: StringishField,
    experian: StringishField,
    transunion: StringishField,
  })
  .partial()
  .passthrough();

const AccountSchema = z
  .object({
    creditor: StringishField,
    account_number: StringishField,
    account_type: StringishField,
    status: StringishField,
    date_opened: StringishField,
    date_reported: StringishField,
    balances: PerBureauField.optional(),
    payment_status: PerBureauField.optional(),
    high_credit: StringishField,
    credit_limit: StringishField,
    payment_history: StringishField,
    comments: StringishField,
    dispute_status: StringishField,
  })
  .passthrough();

const CollectionSchema = z
  .object({
    collector: StringishField,
    original_creditor: StringishField,
    account_number: StringishField,
    balance: StringishField,
    date_opened: StringishField,
    date_reported: StringishField,
    status: StringishField,
    bureaus_reporting: z.array(z.string()).optional(),
    bureau: StringishField,
    date_assigned: StringishField,
    original_amount: StringishField,
    status_date: StringishField,
    balance_date: StringishField,
    purge_date: StringishField,
    designator: StringishField,
  })
  .passthrough();

const InquirySchema = z
  .object({
    creditor: StringishField,
    date: StringishField,
    type: StringishField,
    bureau: StringishField,
    has_matching_account: z.boolean().optional(),
  })
  .passthrough();

const PublicRecordSchema = z
  .object({
    type: StringishField,
    court: StringishField,
    date_filed: StringishField,
    status: StringishField,
    amount: StringishField,
    bureau: StringishField,
  })
  .passthrough();

const ConsumerSchema = z
  .object({
    name: StringishField,
    ssn_last_4: StringishField,
    dob: StringishField,
    addresses: z.array(z.string()).optional(),
  })
  .passthrough();

export const VhParalegalSchema = z
  .object({
    consumer: ConsumerSchema.optional(),
    accounts: z.array(AccountSchema).optional(),
    collections: z.array(CollectionSchema).optional(),
    inquiries: z.array(InquirySchema).optional(),
    public_records: z.array(PublicRecordSchema).optional(),
    consumer_statements: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type VhParalegalJson = z.infer<typeof VhParalegalSchema>;

// ── In-memory cache ────────────────────────────────────────────────────
// Same text → same paralegal output. 24h TTL, LRU eviction at 64
// entries. Serverless cold starts wipe this; that's fine. The point is
// to dedupe repeat clicks within a hot warm function.
type CacheEntry = { value: VhParalegalJson; expiresAt: number };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 64;

function cacheKey(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function cacheGet(key: string): VhParalegalJson | undefined {
  const hit = CACHE.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    CACHE.delete(key);
    return undefined;
  }
  // Touch — refresh LRU order.
  CACHE.delete(key);
  CACHE.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: VhParalegalJson): void {
  if (CACHE.size >= CACHE_MAX) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey) CACHE.delete(oldestKey);
  }
  CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Public extractor ───────────────────────────────────────────────────

export type ParalegalExtractOpts = {
  model?: string;
};

export async function aiParalegalExtract(
  text: string,
  opts: ParalegalExtractOpts = {},
): Promise<VhParalegalJson> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new ParalegalExtractionError(0, "MISTRAL_API_KEY environment variable is not set.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { consumer: {}, accounts: [], collections: [], inquiries: [], public_records: [] };
  }

  const key = cacheKey(trimmed);
  const cached = cacheGet(key);
  if (cached) return cached;

  const model = opts.model ?? process.env.MISTRAL_PARALEGAL_MODEL ?? DEFAULT_MODEL;

  // Big reports blow past the 8k-output cap. VH solves this with
  // section-based chunking that keeps accounts whole; we do the same.
  // Threshold of 30k chars empirically keeps the paralegal output under
  // a single 8k-token response with room to spare.
  const CHUNK_THRESHOLD = 30_000;
  const chunks =
    trimmed.length > CHUNK_THRESHOLD ? chunkBySection(trimmed) : [trimmed];

  let merged: VhParalegalJson;
  if (chunks.length === 1) {
    merged = await extractOneChunk(apiKey, model, chunks[0]);
  } else {
    // Process chunks in parallel with a small concurrency cap to avoid
    // overwhelming Mistral. Merge in input order so the consumer block
    // from the first chunk wins (which usually holds the personal info).
    const results = await runParalegalChunks(apiKey, model, chunks);
    merged = mergeParalegalResults(results);
  }

  cacheSet(key, merged);
  return merged;
}

async function extractOneChunk(
  apiKey: string,
  model: string,
  chunk: string,
): Promise<VhParalegalJson> {
  const userMessage = `Extract all structured data from this credit report:\n\n${chunk}`;
  try {
    return await callParalegal(apiKey, model, userMessage);
  } catch (firstErr) {
    if (!(firstErr instanceof ParalegalExtractionError)) throw firstErr;
    const stricter = `${userMessage}\n\nReturn ONLY a single JSON object matching the schema. No prose, no markdown, no explanations.`;
    return await callParalegal(apiKey, model, stricter);
  }
}

async function runParalegalChunks(
  apiKey: string,
  model: string,
  chunks: string[],
): Promise<VhParalegalJson[]> {
  const CONCURRENCY = 3;
  const results: VhParalegalJson[] = new Array(chunks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= chunks.length) return;
      results[i] = await extractOneChunk(apiKey, model, chunks[i]);
    }
  }
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, chunks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// Split by account/section headers so no single account is ever cut in
// half. Mirrors VH's `_chunk_by_section` strategy: prefer splitting on
// `\n# <digit>.<digit> ` (account-level markdown headers from Mistral
// OCR) so each chunk has whole accounts. If no headers are found, fall
// back to a soft size-based split that respects paragraph boundaries.
function chunkBySection(text: string): string[] {
  const HEADER = /\n(?=# \d+\.\d+ )/g;
  const MAX_CHUNK = 30_000;
  const MAX_PARTS_BEFORE_MERGE = 8;

  // Section-based split.
  const sections = text.split(HEADER);
  if (sections.length > 1) {
    // Greedily pack sections into chunks under MAX_CHUNK.
    const chunks: string[] = [];
    let buf = "";
    for (const section of sections) {
      if (!buf) {
        buf = section;
      } else if ((buf + "\n" + section).length <= MAX_CHUNK) {
        buf = buf + "\n" + section;
      } else {
        chunks.push(buf);
        buf = section;
      }
    }
    if (buf) chunks.push(buf);
    if (chunks.length > MAX_PARTS_BEFORE_MERGE) {
      // Too many tiny sections; collapse adjacent pairs to keep cost down.
      const merged: string[] = [];
      for (let i = 0; i < chunks.length; i += 2) {
        merged.push(chunks.slice(i, i + 2).join("\n"));
      }
      return merged;
    }
    return chunks;
  }

  // No section headers — fall back to paragraph-boundary splits.
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK) {
    let split = remaining.lastIndexOf("\n\n", MAX_CHUNK);
    if (split < MAX_CHUNK / 2) split = MAX_CHUNK;
    out.push(remaining.slice(0, split));
    remaining = remaining.slice(split);
  }
  if (remaining.length) out.push(remaining);
  return out;
}

function mergeParalegalResults(results: VhParalegalJson[]): VhParalegalJson {
  const out: VhParalegalJson = {
    consumer: undefined,
    accounts: [],
    collections: [],
    inquiries: [],
    public_records: [],
    consumer_statements: [],
  };
  // Track de-dupe by a compound key per entity type.
  const seenAccounts = new Set<string>();
  const seenCollections = new Set<string>();
  const seenInquiries = new Set<string>();
  const seenPublic = new Set<string>();

  for (const r of results) {
    if (!out.consumer && r.consumer && Object.keys(r.consumer).length) {
      out.consumer = r.consumer;
    } else if (out.consumer && r.consumer) {
      // Fill in any missing consumer fields from later chunks.
      for (const [k, v] of Object.entries(r.consumer)) {
        const cur = (out.consumer as Record<string, unknown>)[k];
        if ((cur == null || cur === "") && v != null && v !== "") {
          (out.consumer as Record<string, unknown>)[k] = v;
        }
      }
    }

    for (const a of r.accounts ?? []) {
      const key = JSON.stringify([a.creditor, a.account_number]);
      if (seenAccounts.has(key)) continue;
      seenAccounts.add(key);
      out.accounts!.push(a);
    }
    for (const c of r.collections ?? []) {
      const key = JSON.stringify([c.collector, c.account_number]);
      if (seenCollections.has(key)) continue;
      seenCollections.add(key);
      out.collections!.push(c);
    }
    for (const i of r.inquiries ?? []) {
      const key = JSON.stringify([i.creditor, i.date, i.bureau]);
      if (seenInquiries.has(key)) continue;
      seenInquiries.add(key);
      out.inquiries!.push(i);
    }
    for (const p of r.public_records ?? []) {
      const key = JSON.stringify([p.type, p.date_filed, p.court]);
      if (seenPublic.has(key)) continue;
      seenPublic.add(key);
      out.public_records!.push(p);
    }
  }
  return out;
}

async function callParalegal(
  apiKey: string,
  model: string,
  userMessage: string,
): Promise<VhParalegalJson> {
  const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PARALEGAL_V1_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    throw new ParalegalExtractionError(res.status, await res.text());
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) {
    throw new ParalegalExtractionError(res.status, "empty content");
  }
  let unparsed: unknown;
  try {
    unparsed = JSON.parse(raw);
  } catch (e) {
    throw new ParalegalExtractionError(
      res.status,
      `JSON parse error: ${(e as Error).message}; content[:300]=${raw.slice(0, 300)}`,
    );
  }
  const result = VhParalegalSchema.safeParse(unparsed);
  if (!result.success) {
    throw new ParalegalExtractionError(
      res.status,
      `Schema validation failed: ${result.error.message}`,
    );
  }
  return result.data;
}
