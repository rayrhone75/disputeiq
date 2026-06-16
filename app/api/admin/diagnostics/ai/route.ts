// Live AI provider test — confirms OPENAI_API_KEY + MISTRAL_API_KEY actually
// work in THIS environment (valid key, reachable, model available). Makes a
// minimal 1-token chat completion against each so it exercises the real
// inference path the paralegal/lawyer pipeline uses, not just key presence.
// OWNER/ADMIN gated. POST so it isn't triggered by prefetch/crawlers.

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderResult = {
  provider: "openai" | "mistral";
  ok: boolean;
  configured: boolean;
  model?: string;
  latencyMs?: number;
  status?: number;
  error?: string;
};

async function ping(
  provider: "openai" | "mistral",
  url: string,
  apiKey: string | undefined,
  model: string,
): Promise<ProviderResult> {
  if (!apiKey) return { provider, ok: false, configured: false, error: "API key not set" };
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        provider,
        ok: false,
        configured: true,
        model,
        latencyMs,
        status: res.status,
        error: text.slice(0, 300) || `HTTP ${res.status}`,
      };
    }
    return { provider, ok: true, configured: true, model, latencyMs, status: res.status };
  } catch (err) {
    return {
      provider,
      ok: false,
      configured: true,
      model,
      error: (err as Error).name === "AbortError" ? "timed out (20s)" : (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST() {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [openai, mistral] = await Promise.all([
    ping(
      "openai",
      "https://api.openai.com/v1/chat/completions",
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_LAWYER_MODEL ?? "gpt-4o-mini",
    ),
    ping(
      "mistral",
      "https://api.mistral.ai/v1/chat/completions",
      process.env.MISTRAL_API_KEY,
      process.env.MISTRAL_PARALEGAL_MODEL ?? "mistral-large-latest",
    ),
  ]);

  return NextResponse.json({ ok: openai.ok && mistral.ok, openai, mistral });
}
