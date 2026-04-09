import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { callClaude } from "@/lib/ai/client";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  kind: z.enum([
    "instagram",
    "tiktok",
    "facebook",
    "twitter_thread",
    "comment_reply",
    "dm_reply",
    "campaign_7day",
    "viral_hooks",
  ]),
  prompt: z.string().min(1).max(4000),
});

const SYSTEMS: Record<string, string> = {
  instagram:
    "You generate Instagram captions for DisputeIQ — a credit-action platform. Tone: confident, plain-English, no hype, no scammy promises. 1-3 captions. Include 5-10 relevant hashtags.",
  tiktok:
    "You generate TikTok hooks (the first 3 seconds of a script) for DisputeIQ. Each hook is one short, punchy sentence designed to stop scrolling. Provide 5 distinct hooks.",
  facebook:
    "You write Facebook posts for DisputeIQ. Conversational, story-driven, 80-150 words, ending with a soft CTA to /get-started.",
  twitter_thread:
    "You write Twitter/X threads for DisputeIQ. 6-10 tweets, each ≤270 chars, no thread-padding, no fake urgency. End with a CTA.",
  comment_reply:
    "You generate replies to social-media comments on DisputeIQ posts. Be helpful, never argumentative, never give legal advice. Keep replies under 60 words. If the comment is hostile, defuse politely.",
  dm_reply:
    "You generate replies to INBOUND direct messages on DisputeIQ accounts. The user has messaged us first. Be warm, helpful, push toward /get-started when appropriate. Never auto-DM strangers — these are responses only.",
  campaign_7day:
    "You generate a 7-day content calendar for DisputeIQ across Instagram, TikTok, and Twitter. Each day: theme + post idea per platform.",
  viral_hooks:
    "You generate viral-style hooks for credit-repair content. 10 hooks, each one sentence, each addressing a real consumer pain point. No fake claims.",
};

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await callClaude({
    model: "opus",
    system: SYSTEMS[parsed.data.kind],
    user: parsed.data.prompt,
    maxTokens: 1500,
    temperature: 0.7,
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "GROWTH_GENERATED",
    entityType: "GrowthContent",
    entityId: parsed.data.kind,
    metadataJson: { kind: parsed.data.kind, live: result.live, promptLen: parsed.data.prompt.length },
  });

  return NextResponse.json({ output: result.text, live: result.live });
}
