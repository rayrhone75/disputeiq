// VH law-firm pipeline — paralegal output → FCRA violations.
//
// Port of ViolationHunter AI's analyze_credit_report pipeline
// (backend/credit_dispute_ai.py:2088-2210). Five stages:
//
//   1. Lead Agent — pure-TS routing. Splits accounts into four
//      specialist buckets by category (collections, revolving,
//      inquiries, installment). No LLM call.
//   2. Specialist Lawyers ×4 — parallel OpenAI calls. Each lawyer
//      sees only its assigned slice of the report and returns
//      violations with FCRA section citations + per-bureau evidence.
//   3. Adversarial Review — OpenAI call. Plays devil's advocate
//      against each violation; tags defense_strength
//      (bulletproof/strong/vulnerable). Bulletproofs get bumped to
//      critical severity automatically.
//   4. Deterministic Dedup — pure TS. Collapses violations from
//      different lawyers that hit the same creditor + violation_type
//      + bureau, keeping the one with the richest evidence.
//   5. Senior Partner — OpenAI call. Final rank + round_strategy
//      assignment (top 3-5 → round1, rest → round2). Batches at
//      MAX_BATCH = 15 to stay under gpt-4o-mini's output cap.
//
// Output shape matches VH's /api/analyze response so downstream UI
// + dispute-letter generation can swap in cleanly.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { VhParalegalJson } from "./ai-paralegal";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

const PROMPTS_DIR = path.join(process.cwd(), "lib", "credit-import", "prompts");

// Lazy + memoized prompt loading. Reading at call-time (not module load)
// keeps a missing file from crashing the whole route's import, and the
// thrown error names the exact missing file instead of silently handing
// OpenAI an empty system prompt (which produces garbage violations).
//
// NOTE: these .txt files are pulled in via `fs` at runtime, so they must
// be traced into the Vercel serverless bundle — see
// `outputFileTracingIncludes` in next.config.mjs. If that include is
// dropped, this throw is what surfaces the problem in the logs.
const promptCache = new Map<string, string>();
function loadPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached !== undefined) return cached;
  let body: string;
  try {
    body = fs.readFileSync(path.join(PROMPTS_DIR, name), "utf8");
  } catch (err) {
    throw new LawyerPipelineError(
      "prompt_load",
      0,
      `Prompt file "${name}" could not be read from ${PROMPTS_DIR}: ${(err as Error).message}. ` +
        `On Vercel this usually means the file wasn't bundled — check outputFileTracingIncludes in next.config.mjs.`,
    );
  }
  if (!body.trim()) {
    throw new LawyerPipelineError(
      "prompt_load",
      0,
      `Prompt file "${name}" is empty — refusing to call OpenAI with a blank system prompt.`,
    );
  }
  promptCache.set(name, body);
  return body;
}

export class LawyerPipelineError extends Error {
  stage: string;
  status: number;
  body: string;
  constructor(stage: string, status: number, body: string) {
    super(`Lawyer pipeline ${stage} failed (${status}): ${body.slice(0, 400)}`);
    this.name = "LawyerPipelineError";
    this.stage = stage;
    this.status = status;
    this.body = body;
  }
}

export type Severity = "critical" | "high" | "medium" | "low";
export type DefenseStrength = "bulletproof" | "strong" | "vulnerable";

export type Violation = {
  fcra_section: string;
  account_name: string;
  violation_type: string;
  description: string;
  evidence: string;
  severity: Severity;
  confidence?: number;
  bureaus?: string[];
  disputed_fields?: string[];
  field_values?: Record<string, Record<string, string>>;
  target_bureaus?: string[];
  dispute_argument?: string;
  dispute_strategy?: string;
  defense_strength?: DefenseStrength;
  defense_argument?: string;
  how_to_strengthen?: string;
  round_strategy?: "round1" | "round2";
  detected_by?: string;
};

export type RemovedViolation = {
  account_name: string;
  violation_type: string;
  reason_removed: string;
};

export type LawyerPipelineResult = {
  violations: Violation[];
  summary: string;
  removed: RemovedViolation[];
  pipeline: {
    total_seconds: number;
    lawyer_count: number;
    lawyer_stats: Record<string, number>;
    // Count *after* the specialist lawyers run but *before* dedup. Lets
    // consumers reason about LLM throughput vs. final dispute count.
    // Matches VH's response field (api_server.py:707).
    total_specialist_violations: number;
    // No-op shim for VH-shape compatibility. We don't run a cross-check
    // stage; the field is present so any consumer written against VH's
    // /api/analyze JSON works without conditional branching.
    cross_check: {
      agreed: number;
      disputed: number;
      cross_verified: number;
      cross_rejected: number;
      elapsed_seconds: number;
    };
    final_count: number;
  };
  models_used: string[];
};

// Progress events emitted at every stage boundary. Mirrors VH's
// `_emit(stage, status, **meta)` SSE protocol so the same UI patterns
// VH ships can render our progress without translation.
export type ProgressEvent = {
  stage:
    | "paralegal"
    | "lead_agent"
    | "lawyers"
    | "adversarial_review"
    | "senior_partner";
  status: "started" | "complete";
  [meta: string]: unknown;
};
export type ProgressFn = (e: ProgressEvent) => void;

export type LawyerPipelineOpts = {
  model?: string;
  onProgress?: ProgressFn;
  /**
   * Skip the adversarial review stage entirely. The stage only adds
   * `defense_strength` annotation to each violation (bulletproof /
   * strong / vulnerable) — it doesn't change which violations exist.
   * Skipping shaves one full LLM round-trip per N/10 batches off the
   * critical path. Defaults to true so the customer-facing
   * analyze-stream path is fast; back-office re-runs that want the
   * annotation can pass `false`.
   */
  skipAdversarial?: boolean;
  /**
   * Skip the senior-partner LLM and do dedup + ranking + round_strategy
   * deterministically in pure TS. Cuts the longest sequential step from
   * the customer-facing pipeline (1-2 minutes → instant). What you lose:
   * the LLM-generated `dispute_strategy` per violation (replaced by a
   * sensible default per violation_type), and the case-level prose
   * summary (replaced by a templated count). Defaults to true.
   */
  skipSeniorPartner?: boolean;
};

// ── Public entrypoint ──────────────────────────────────────────────────

export async function runLawyerPipeline(
  structured: VhParalegalJson,
  opts: LawyerPipelineOpts = {},
): Promise<LawyerPipelineResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LawyerPipelineError(
      "init",
      0,
      "OPENAI_API_KEY environment variable is not set.",
    );
  }
  const model = opts.model ?? process.env.OPENAI_LAWYER_MODEL ?? DEFAULT_MODEL;
  const emit = opts.onProgress ?? (() => {});
  const t0 = Date.now();

  // Synthetic paralegal event — the work already happened upstream when
  // the upload pipeline persisted the paralegal row, but the SSE
  // consumer expects to see the stage land. Emit started+complete back
  // to back with the counts we already have.
  emit({ stage: "paralegal", status: "started" });
  emit({
    stage: "paralegal",
    status: "complete",
    accounts: (structured.accounts ?? []).length,
    collections: (structured.collections ?? []).length,
    inquiries: (structured.inquiries ?? []).length,
  });

  // Stage 1: lead agent (pure TS, no LLM).
  emit({ stage: "lead_agent", status: "started" });
  const rawAssignments = leadAgentDelegate(structured);
  // Any assignment with too many items gets split into parallel
  // sub-shards so a single overloaded lawyer (e.g. "C" with 37
  // inquiries) doesn't pin the critical path. Each shard runs as its
  // own LLM call; results merge back under the original lawyer_id.
  const assignments = shardLargeAssignments(rawAssignments);
  emit({
    stage: "lead_agent",
    status: "complete",
    assignments: rawAssignments.length,
    shards: assignments.length,
  });

  // Stage 2: specialist lawyers in parallel.
  emit({
    stage: "lawyers",
    status: "started",
    lawyer_count: rawAssignments.length,
    shard_count: assignments.length,
  });
  const consumer = (structured.consumer ?? {}) as Record<string, unknown>;
  const lawyerStats: Record<string, number> = {};
  const lawyerResults = await Promise.all(
    assignments.map(async (assignment) => {
      try {
        const res = await specialistLawyerAnalyze(
          apiKey,
          model,
          assignment,
          consumer,
        );
        const violations = res.violations ?? [];
        lawyerStats[assignment.lawyer_id] =
          (lawyerStats[assignment.lawyer_id] ?? 0) + violations.length;
        for (const v of violations)
          v.detected_by = `lawyer_${assignment.lawyer_id.toLowerCase()}`;
        return violations;
      } catch (err) {
        // Don't fail the whole pipeline if one shard croaks; record 0
        // and continue. The senior partner will still see the rest.
        // eslint-disable-next-line no-console
        console.error("[lawyer-pipeline] lawyer_failed", {
          lawyer: assignment.lawyer_id,
          message: (err as Error).message,
        });
        lawyerStats[assignment.lawyer_id] = lawyerStats[assignment.lawyer_id] ?? 0;
        return [] as Violation[];
      }
    }),
  );
  const allViolations = lawyerResults.flat();
  emit({
    stage: "lawyers",
    status: "complete",
    lawyer_count: assignments.length,
    total_violations: allViolations.length,
    lawyer_stats: lawyerStats,
  });

  // Stage 3: adversarial review (batched, parallel). Optional.
  const skipAdv = opts.skipAdversarial ?? true;
  let reviewed = allViolations;
  let bulletproof = 0;
  if (!skipAdv) {
    emit({ stage: "adversarial_review", status: "started" });
    reviewed = await adversarialReview(apiKey, model, allViolations);
    bulletproof = reviewed.filter(
      (v) => v.defense_strength === "bulletproof",
    ).length;
    emit({
      stage: "adversarial_review",
      status: "complete",
      bulletproof,
    });
  } else {
    // Emit the start+complete back-to-back with skipped flag so the
    // SSE consumer's progress UI doesn't hang on a stage that never
    // fires. Surfaces the decision in client logs too.
    emit({ stage: "adversarial_review", status: "started", skipped: true });
    emit({
      stage: "adversarial_review",
      status: "complete",
      skipped: true,
      bulletproof: 0,
    });
  }

  // Stage 4: deterministic dedup (no event — too short to be meaningful).
  const deduped = deterministicDedup(reviewed);

  // Stage 5: senior partner — LLM ranking + summary OR deterministic
  // fast path. The LLM path matches VH exactly but takes 60-120s on a
  // 40+ violation report; the deterministic path produces equivalent
  // ranking using severity + evidence length and finishes in ~0ms.
  emit({ stage: "senior_partner", status: "started" });
  const skipSenior = opts.skipSeniorPartner ?? true;
  const senior = skipSenior
    ? deterministicSeniorReview(deduped)
    : await seniorReview(apiKey, model, deduped, structured);
  emit({
    stage: "senior_partner",
    status: "complete",
    final_count: senior.violations.length,
    deterministic: skipSenior,
  });

  const totalSeconds = (Date.now() - t0) / 1000;
  return {
    violations: senior.violations,
    summary: senior.summary,
    removed: senior.removed,
    pipeline: {
      total_seconds: totalSeconds,
      lawyer_count: assignments.length,
      lawyer_stats: lawyerStats,
      total_specialist_violations: allViolations.length,
      cross_check: {
        agreed: senior.violations.length,
        disputed: 0,
        cross_verified: 0,
        cross_rejected: 0,
        elapsed_seconds: 0,
      },
      final_count: senior.violations.length,
    },
    models_used: [model],
  };
}

// ── Stage 1: Lead Agent — pure-TS bucket assignment ────────────────────

type Assignment = {
  lawyer_id: "A" | "B" | "C" | "D";
  specialty: string;
  focus: string;
  accounts: Record<string, unknown>[];
  collections: Record<string, unknown>[];
  inquiries: Record<string, unknown>[];
  consumer_statements: unknown[];
};

function leadAgentDelegate(structured: VhParalegalJson): Assignment[] {
  const accounts = (structured.accounts ?? []) as Record<string, unknown>[];
  const collections = (structured.collections ?? []) as Record<string, unknown>[];
  const inquiries = (structured.inquiries ?? []) as Record<string, unknown>[];
  const consumerStatements = (structured.consumer_statements ?? []) as unknown[];

  const assignments: Assignment[] = [];

  // Lawyer A — Collections / Medical / Identity theft.
  const collectionAccounts = accounts.filter((a) => {
    const status = String(a.status ?? "").toLowerCase();
    const accountType = String(a.account_type ?? "").toLowerCase();
    const paymentStatus = serialize(a.payment_status).toLowerCase();
    return (
      status === "negative" ||
      accountType.includes("collection") ||
      paymentStatus.includes("collection")
    );
  });
  const collectorNames = new Set(
    collections.map((c) => String(c.collector ?? "").toUpperCase()),
  );
  for (const a of accounts) {
    if (
      collectorNames.has(String(a.creditor ?? "").toUpperCase()) &&
      !collectionAccounts.includes(a)
    ) {
      collectionAccounts.push(a);
    }
  }
  if (collectionAccounts.length > 0 || collections.length > 0) {
    assignments.push({
      lawyer_id: "A",
      specialty: "Collections, Medical Debt & Identity Theft",
      focus:
        "Check for: medical debt under $500 (April 2023 rule), missing original creditor names (623(a)(2)), re-aging of DOFD, identity theft with fraud alert, expired debt past 7-year limit, HIPAA verification demands",
      accounts: collectionAccounts,
      collections,
      consumer_statements: consumerStatements,
      inquiries: [],
    });
  }

  // Lawyer B — Revolving / credit cards.
  const REVOLVING_TYPES = new Set([
    "revolving",
    "creditcard",
    "credit card",
    "line of credit",
    "charge account",
  ]);
  const revolving = accounts.filter(
    (a) =>
      REVOLVING_TYPES.has(String(a.account_type ?? "").toLowerCase()) &&
      !collectionAccounts.includes(a),
  );
  if (revolving.length > 0) {
    assignments.push({
      lawyer_id: "B",
      specialty: "Revolving Accounts & Credit Cards",
      focus:
        "Check for: balance inconsistencies across bureaus, payment status differences, accounts open on one bureau but closed on another, incorrect credit limits, late payments reported inconsistently",
      accounts: revolving,
      collections: [],
      consumer_statements: [],
      inquiries: [],
    });
  }

  // Lawyer C — Inquiries.
  if (inquiries.length > 0) {
    assignments.push({
      lawyer_id: "C",
      specialty: "Hard Inquiries & Permissible Purpose",
      focus:
        "Check for: unauthorized inquiries without matching accounts, rate-shopping clusters (auto/mortgage inquiries within 14-45 days should count as one), inquiries older than 2 years, inquiries from companies consumer doesn't recognize",
      accounts: [],
      collections: [],
      consumer_statements: [],
      inquiries,
    });
  }

  // Lawyer D — Installment / other (catches anything unassigned).
  const INSTALLMENT_TYPES = new Set([
    "installment",
    "mortgage",
    "automobile",
    "student loan",
    "personal loan",
    "secured",
    "other",
    "rental agreement",
    "unknown",
  ]);
  const installment = accounts.filter(
    (a) =>
      INSTALLMENT_TYPES.has(String(a.account_type ?? "").toLowerCase()) &&
      !collectionAccounts.includes(a) &&
      !revolving.includes(a),
  );
  const assignedSet = new Set<Record<string, unknown>>([
    ...collectionAccounts,
    ...revolving,
    ...installment,
  ]);
  for (const a of accounts) {
    if (!assignedSet.has(a)) installment.push(a);
  }
  if (installment.length > 0) {
    assignments.push({
      lawyer_id: "D",
      specialty: "Installment, Auto & Other Accounts",
      focus:
        "Check for: balance discrepancies, expired accounts past 7-year limit, incorrect payment history, accounts reported to wrong bureaus, duplicate reporting",
      accounts: installment,
      collections: [],
      consumer_statements: [],
      inquiries: [],
    });
  }

  return assignments;
}

function serialize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Splits any assignment whose primary bucket exceeds SHARD_SIZE into
// multiple smaller assignments so a single overloaded lawyer (e.g.
// "C" with 37 inquiries) doesn't bottleneck the parallel fan-out.
// Each shard is a copy of the original assignment with only its slice
// of the bucket populated. lawyer_id is preserved so stats + the UI
// see one logical lawyer even when split.
const SHARD_SIZE = 12;

function shardLargeAssignments(assignments: Assignment[]): Assignment[] {
  const out: Assignment[] = [];
  for (const a of assignments) {
    const buckets: Array<{
      key: "accounts" | "collections" | "inquiries";
      items: Record<string, unknown>[];
    }> = [
      { key: "accounts", items: a.accounts },
      { key: "collections", items: a.collections },
      { key: "inquiries", items: a.inquiries },
    ];
    // Find the bucket that's actually populated. The lead-agent only
    // puts data in one bucket per assignment, so this is the bucket
    // we need to shard (if any).
    const primary = buckets.find((b) => b.items.length > 0);
    if (!primary || primary.items.length <= SHARD_SIZE) {
      out.push(a);
      continue;
    }
    for (let i = 0; i < primary.items.length; i += SHARD_SIZE) {
      const slice = primary.items.slice(i, i + SHARD_SIZE);
      out.push({
        lawyer_id: a.lawyer_id,
        specialty: a.specialty,
        focus: a.focus,
        accounts: primary.key === "accounts" ? slice : a.accounts,
        collections: primary.key === "collections" ? slice : a.collections,
        inquiries: primary.key === "inquiries" ? slice : a.inquiries,
        consumer_statements: a.consumer_statements,
      });
    }
  }
  return out;
}

// ── Stage 2: Specialist Lawyers — OpenAI ───────────────────────────────

type LawyerResult = { violations: Violation[]; summary?: string };

async function specialistLawyerAnalyze(
  apiKey: string,
  model: string,
  assignment: Assignment,
  consumer: Record<string, unknown>,
): Promise<LawyerResult> {
  const today = new Date().toISOString().slice(0, 10);
  const system = loadPrompt("lawyer_v1.txt").replace("{today}", today);

  const assignedData = {
    consumer,
    accounts: assignment.accounts,
    collections: assignment.collections,
    inquiries: assignment.inquiries,
    consumer_statements: assignment.consumer_statements,
  };
  let assignedJson = JSON.stringify(assignedData);

  // Slim accounts if oversized (matches credit_dispute_ai.py:1747).
  if (assignedJson.length > 40_000) {
    const SLIM_KEYS = new Set([
      "creditor",
      "status",
      "account_type",
      "balance",
      "balances",
      "date_opened",
      "payment_status",
      "comments",
      "condition",
      "bureaus_reporting",
      "open_closed",
      "high_credit",
      "credit_limit",
      "date_reported",
      "date_of_first_delinquency",
    ]);
    const slimAccounts = assignment.accounts.map((a) =>
      Object.fromEntries(Object.entries(a).filter(([k]) => SLIM_KEYS.has(k))),
    );
    assignedJson = JSON.stringify({ ...assignedData, accounts: slimAccounts });
  }

  const userPrompt = `You are Lawyer ${assignment.lawyer_id}, specializing in: ${assignment.specialty}

YOUR ASSIGNMENT: Analyze ONLY the accounts assigned to you below for ALL FCRA violations.
FOCUS: ${assignment.focus}

ASSIGNED DATA:
${assignedJson}`;

  const raw = await openaiChat(apiKey, "specialist_lawyer", {
    model,
    temperature: 0.1,
    max_tokens: 16384,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });
  const parsed = parseJsonResponse(raw);
  return {
    violations: Array.isArray(parsed.violations) ? (parsed.violations as Violation[]) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
  };
}

// ── Stage 3: Adversarial Review ────────────────────────────────────────

const ADVERSARIAL_PROMPT = `You are a defense attorney representing the credit bureau/furnisher.
For each FCRA violation claimed by the consumer's attorneys, identify:
1. The strongest counter-argument the furnisher could make
2. Whether the violation is BULLETPROOF (no defense), STRONG (weak defense), or VULNERABLE (good defense exists)
3. What additional evidence would make the violation unbeatable

Respond ONLY with valid JSON:
{
  "reviews": [
    {
      "account_name": "...",
      "violation_type": "...",
      "strength": "bulletproof",
      "defense_argument": "What the furnisher would argue",
      "how_to_strengthen": "What evidence or argument would make this unbeatable"
    }
  ]
}`;

async function adversarialReview(
  apiKey: string,
  model: string,
  violations: Violation[],
): Promise<Violation[]> {
  if (violations.length === 0) return violations;
  // Batch by 10 to keep prompts small (matches VH:1955-1958). Batches
  // are independent — no batch's review depends on another batch's
  // output — so we run them in parallel. This is the single biggest
  // latency win in the pipeline: a 40-violation report drops from
  // 4×N seconds sequential to ~N seconds parallel.
  const batches: Violation[][] = [];
  for (let i = 0; i < violations.length; i += 10) {
    batches.push(violations.slice(i, i + 10));
  }
  const reviewedBatches = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      try {
        const raw = await openaiChat(apiKey, "adversarial_review", {
          model,
          temperature: 0.1,
          max_tokens: 4096,
          messages: [
            { role: "system", content: ADVERSARIAL_PROMPT },
            {
              role: "user",
              content:
                "Review these FCRA violations from the consumer's perspective. Find weaknesses:\n\n" +
                JSON.stringify(batch),
            },
          ],
          response_format: { type: "json_object" },
        });
        const parsed = parseJsonResponse(raw);
        const reviews = Array.isArray(parsed.reviews)
          ? (parsed.reviews as Array<Record<string, unknown>>)
          : [];
        return batch.map((src, j) => {
          const v = { ...src };
          const review = reviews[j];
          if (review) {
            const strength = String(review.strength ?? "unknown").toLowerCase();
            if (
              strength === "bulletproof" ||
              strength === "strong" ||
              strength === "vulnerable"
            ) {
              v.defense_strength = strength;
            }
            if (typeof review.defense_argument === "string") {
              v.defense_argument = review.defense_argument;
            }
            if (typeof review.how_to_strengthen === "string") {
              v.how_to_strengthen = review.how_to_strengthen;
            }
            if (v.defense_strength === "bulletproof" && v.severity !== "critical") {
              v.severity = "critical";
            }
          }
          return v;
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lawyer-pipeline] adversarial_batch_failed", {
          batch_index: batchIndex,
          message: (err as Error).message,
        });
        return batch;
      }
    }),
  );
  return reviewedBatches.flat();
}

// ── Stage 4: Deterministic Dedup — pure TS ─────────────────────────────

const ABBREVS: Record<string, string> = {
  fcu: "federalcreditunion",
  cu: "creditunion",
  acce: "acceptance",
  svc: "service",
  svcs: "services",
  fin: "financial",
  fncl: "financial",
  natl: "national",
  bnk: "bank",
  bk: "bank",
  mtg: "mortgage",
  ins: "insurance",
};

function normalizeCreditor(name: string): string {
  let n = name.toLowerCase().trim();
  for (const [abbr, full] of Object.entries(ABBREVS)) {
    n = n.split(abbr).join(full);
  }
  return n.replace(/[^a-z0-9]/g, "");
}

const BUREAU_SPECIFIC_TYPES = new Set([
  "inaccurate_balance",
  "expired_debt",
  "duplicate_account",
  "outdated_inquiry",
]);

function deterministicDedup(violations: Violation[]): Violation[] {
  const seen = new Map<string, Violation>();
  for (const v of violations) {
    const name = normalizeCreditor(v.account_name ?? "");
    const vtype = (v.violation_type ?? "").toLowerCase();
    let bureau = "";
    if (BUREAU_SPECIFIC_TYPES.has(vtype)) {
      const haystack = ((v.evidence ?? "") + (v.description ?? "")).toLowerCase();
      for (const b of ["equifax", "experian", "transunion"]) {
        if (haystack.includes(b)) {
          bureau = b;
          break;
        }
      }
    }
    const key = `${name}|${vtype}|${bureau}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, v);
    } else if ((v.evidence?.length ?? 0) > (existing.evidence?.length ?? 0)) {
      seen.set(key, v);
    }
  }
  return Array.from(seen.values());
}

// ── Stage 5: Senior Partner — deterministic fast path ─────────────────

// Default dispute strategies keyed by FCRA section. Mirrors what the
// LLM senior partner usually outputs; works without an LLM call when
// the customer just wants speed. Used by `deterministicSeniorReview`.
const DEFAULT_STRATEGY_BY_SECTION: Record<string, string> = {
  "609":
    "Send a §609 verification demand letter requiring the furnisher to produce original signed documentation.",
  "611":
    "Send a §611 dispute letter to the bureau requesting reinvestigation within 30 days.",
  "623":
    "Send a §623(a)(8) direct-furnisher dispute citing failure to report accurate information.",
  "604":
    "Send an unauthorized-inquiry challenge citing lack of permissible purpose under §604.",
  "605":
    "Send a §605 removal request — the item is past the 7-year reporting limit.",
  "605B":
    "File a §605B identity-theft block request with the bureau and attach the FTC identity-theft report.",
};

function defaultStrategy(v: Violation): string {
  return (
    v.dispute_strategy ??
    DEFAULT_STRATEGY_BY_SECTION[(v.fcra_section ?? "").trim()] ??
    "Send a §611 reinvestigation demand to the reporting bureau."
  );
}

// Pure-TS replacement for the LLM senior-partner stage. Ranks
// violations by (severity, defense_strength, evidence length), tags
// the top 5 as round1 and the rest as round2, fills in
// dispute_strategy from a section-keyed lookup when missing, and
// emits a templated case summary.
function deterministicSeniorReview(violations: Violation[]): SeniorResult {
  if (violations.length === 0) {
    return {
      violations: [],
      removed: [],
      summary: "No FCRA violations detected.",
    };
  }
  const SEVERITY_RANK: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const DEFENSE_RANK: Record<string, number> = {
    bulletproof: 0,
    strong: 1,
    vulnerable: 2,
  };
  const sorted = [...violations].sort((a, b) => {
    const sv =
      (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4);
    if (sv !== 0) return sv;
    const ds =
      (DEFENSE_RANK[a.defense_strength ?? "vulnerable"] ?? 3) -
      (DEFENSE_RANK[b.defense_strength ?? "vulnerable"] ?? 3);
    if (ds !== 0) return ds;
    return (b.evidence?.length ?? 0) - (a.evidence?.length ?? 0);
  });
  const ranked: Violation[] = sorted.map((v, i) => ({
    ...v,
    round_strategy: i < 5 ? ("round1" as const) : ("round2" as const),
    dispute_strategy: defaultStrategy(v),
  }));
  const sections = new Set(ranked.map((v) => v.fcra_section));
  const bureaus = new Set(
    ranked.flatMap((v) => v.bureaus ?? v.target_bureaus ?? []),
  );
  const summary = `Identified ${ranked.length} FCRA violation${
    ranked.length === 1 ? "" : "s"
  } across ${sections.size} statute section${sections.size === 1 ? "" : "s"}${
    bureaus.size > 0 ? ` and ${bureaus.size} bureau${bureaus.size === 1 ? "" : "s"}` : ""
  }. Top ${Math.min(5, ranked.length)} disputes queued for round 1.`;
  return { violations: ranked, removed: [], summary };
}

// ── Stage 5 (LLM): Senior Partner ──────────────────────────────────────

type SeniorResult = {
  violations: Violation[];
  removed: RemovedViolation[];
  summary: string;
};

async function seniorReview(
  apiKey: string,
  model: string,
  violations: Violation[],
  structured: VhParalegalJson,
): Promise<SeniorResult> {
  if (violations.length === 0) {
    return { violations: [], removed: [], summary: "No violations to review." };
  }
  const today = new Date().toISOString().slice(0, 10);
  const system = loadPrompt("senior_partner_v1.txt").replace("{today}", today);

  const slim = {
    consumer: structured.consumer ?? {},
    account_names: Array.from(
      new Set(
        ((structured.accounts ?? []) as Record<string, unknown>[])
          .map((a) => String(a.creditor ?? ""))
          .filter(Boolean),
      ),
    ),
    collection_names: Array.from(
      new Set(
        ((structured.collections ?? []) as Record<string, unknown>[])
          .map((c) => String(c.collector ?? ""))
          .filter(Boolean),
      ),
    ),
    total_accounts: (structured.accounts ?? []).length,
    total_inquiries: (structured.inquiries ?? []).length,
  };

  const MAX_BATCH = 15;
  const batches: Violation[][] = [];
  for (let i = 0; i < violations.length; i += MAX_BATCH) {
    batches.push(violations.slice(i, i + MAX_BATCH));
  }
  const batchCount = batches.length;

  // Run all senior-partner batches in parallel. Each batch returns its
  // own ranked violations + removed list independently — there's no
  // cross-batch dedup at this stage (deterministicDedup already ran).
  // The summary is taken from the last batch's output if present.
  const batchResults = await Promise.all(
    batches.map(async (batch, idx) => {
      const userPrompt = `Review these FCRA violations found by the team (batch ${idx + 1}/${batchCount}). Remove duplicates, rank by strength, and add dispute strategies.

VIOLATIONS TO REVIEW:
${JSON.stringify(batch)}

CREDIT REPORT SUMMARY (for reference):
${JSON.stringify(slim)}`;
      try {
        const raw = await openaiChat(apiKey, "senior_partner", {
          model,
          temperature: 0.1,
          max_tokens: 8192,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });
        return parseJsonResponse(raw);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lawyer-pipeline] senior_batch_failed", {
          batch_index: idx,
          message: (err as Error).message,
        });
        // Pass the batch through unranked rather than dropping the
        // violations entirely — the customer still sees them, just
        // without the senior-partner ranking polish.
        return { violations: batch, removed: [], summary: "" };
      }
    }),
  );

  const allFinal: Violation[] = [];
  const allRemoved: RemovedViolation[] = [];
  let summary = "";
  for (let i = 0; i < batchResults.length; i++) {
    const parsed = batchResults[i];
    if (Array.isArray(parsed.violations)) {
      allFinal.push(...(parsed.violations as Violation[]));
    }
    if (Array.isArray(parsed.removed)) {
      allRemoved.push(...(parsed.removed as RemovedViolation[]));
    }
    if (i === batchResults.length - 1 && typeof parsed.summary === "string" && parsed.summary) {
      summary = parsed.summary;
    }
  }
  return {
    violations: allFinal,
    removed: allRemoved,
    summary:
      summary ||
      `Reviewed ${violations.length} violations in ${batchCount} batch${batchCount === 1 ? "" : "es"}. ${allFinal.length} passed review.`,
  };
}

// ── OpenAI HTTP helper ─────────────────────────────────────────────────

type ChatRequest = {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  response_format?: { type: "json_object" };
};

async function openaiChat(
  apiKey: string,
  stage: string,
  body: ChatRequest,
): Promise<string> {
  const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new LawyerPipelineError(stage, res.status, await res.text());
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new LawyerPipelineError(stage, res.status, "empty content");
  }
  return content;
}

const JsonResponseSchema = z.object({}).passthrough();

function parseJsonResponse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    const result = JsonResponseSchema.safeParse(parsed);
    if (!result.success) return {};
    return result.data as Record<string, unknown>;
  } catch {
    // Some models wrap JSON in ```json fences despite response_format.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}
