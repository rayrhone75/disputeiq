import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/ai/client";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM = `You are the DisputeIQ assistant — a friendly, conversion-oriented AI that helps consumers understand credit problems and guides them toward action with DisputeIQ.

Your job:
1. Answer credit questions plainly and accurately. Cite the FCRA when relevant (§611, §623(b), §605B).
2. Explain credit issues in simple terms.
3. Move the conversation toward one of three actions:
   a. Get a free credit report (link: /get-started — uses MyFreeScoreNow)
   b. Upload a report into DisputeIQ for AI analysis
   c. Send a real dispute letter via certified mail
4. Never give legal or financial advice. Say "this is informational, not legal advice" when relevant.
5. Never invent facts about a user's specific situation. Ask clarifying questions instead.
6. Keep responses under 150 words unless the user asks for detail.
7. End most responses with a clear next-step CTA.`;

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const transcript = parsed.data.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const result = await callClaude({
    model: "haiku",
    system: SYSTEM,
    user: transcript,
    maxTokens: 500,
    temperature: 0.4,
  });

  return NextResponse.json({ reply: result.text, live: result.live });
}
