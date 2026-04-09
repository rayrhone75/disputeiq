// Shared Anthropic Claude client. Uses fetch directly against the Messages API
// so we don't pull a new dependency. Real calls when ANTHROPIC_API_KEY is set;
// deterministic offline fallback otherwise so dev + tests still run.
//
// Models:
//   - opus  → drafting (letters, complaints)
//   - haiku → assistant/explanations, fast analysis
//
// Rules:
//   - never invent facts; callers pass structured grounding
//   - response is free text; callers parse/extract what they need
//   - all calls log token usage to console for cost visibility

const ANTHROPIC_BASE = process.env.ANTHROPIC_API_BASE ?? "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

// Provider gate. AI_PROVIDER must equal "anthropic" for live calls; any other
// value (or unset) keeps the deterministic offline fallback so dev/tests don't
// burn tokens. The dispute pipeline NEVER fakes a successful Claude call —
// offline output is clearly labeled and callers can detect via `result.live`.
const AI_PROVIDER = (process.env.AI_PROVIDER ?? "").toLowerCase();
const PROVIDER_LIVE = AI_PROVIDER === "anthropic";

export type ClaudeModel = "opus" | "haiku";

// Model role mapping:
//   opus  → drafting (dispute letters, re-disputes, growth content)
//   haiku → reasoning/assist (analysis summaries, response classification, in-app assistant)
const MODEL_IDS: Record<ClaudeModel, string> = {
  opus:
    process.env.ANTHROPIC_DRAFT_MODEL ??
    process.env.ANTHROPIC_MODEL_OPUS ??
    "claude-opus-4-6",
  haiku:
    process.env.ANTHROPIC_ASSIST_MODEL ??
    process.env.ANTHROPIC_MODEL_HAIKU ??
    "claude-haiku-4-5",
};

export interface ClaudeCallInput {
  model: ClaudeModel;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeCallResult {
  text: string;
  model: string;
  live: boolean;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function callClaude(input: ClaudeCallInput): Promise<ClaudeCallResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = MODEL_IDS[input.model];

  // Live only when provider is explicitly anthropic AND a key is present.
  if (!PROVIDER_LIVE || !key) {
    // Offline fallback: deterministic text so the pipeline still runs end-to-end
    // in dev. Clearly labeled so it cannot be confused for real AI output.
    return {
      text: `[OFFLINE-AI:${input.model}] ${input.user.slice(0, 600)}`,
      model,
      live: false,
    };
  }

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? 1500,
      temperature: input.temperature ?? 0.2,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data: any = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n")
    : "";

  console.log("[claude]", { model, usage: data?.usage });
  return { text, model, live: true, usage: data?.usage };
}
