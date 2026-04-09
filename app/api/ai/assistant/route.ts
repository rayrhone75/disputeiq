import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { callClaude } from "@/lib/ai/client";
import { writeAuditLog } from "@/lib/audit";

// Authenticated, context-grounded AI assistant for the dashboard.
// The model receives a structured snapshot of THIS USER's real report state,
// dispute history, and mail status. It is forbidden from inventing facts or
// quoting tradelines that are not in the snapshot. If the user asks something
// the data doesn't support, the assistant says so.

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

const SYSTEM = `You are the in-app DisputeIQ assistant. You are speaking to a logged-in user inside their dashboard.

GROUND RULES — non-negotiable:
1. You will be given a CONTEXT block describing the user's real credit report data, current disputes, and mail jobs. You may ONLY reference items that appear in that block. If the user asks about a creditor or account that is not in the CONTEXT, say so plainly — do not guess.
2. Never invent balances, dates, account numbers, score numbers, or removal timelines.
3. Never promise a specific outcome or score change. Use language like "may", "is consistent with", "the data shows".
4. Cite the FCRA when relevant (§611, §611(a)(6)(B)(iii), §623(b), §605B), but never give legal advice.
5. When a useful next step exists in DisputeIQ, push the user toward it explicitly: "Open the tri-merge view", "Build a packet for Equifax", "Mark the outcome on your delivered letter", "Generate a re-dispute", "Upload the bureau response", "Queue the secondary freezes".
6. Keep responses under 180 words unless the user explicitly asks for detail.
7. Always end with one clear next action.`;

function buildContext(opts: {
  reports: number;
  tradelineCount: number;
  byBureau: Record<string, number>;
  disputes: Array<{ id: string; status: string; reason: string; bureau?: string; creditor?: string }>;
  mailJobs: Array<{ status: string; deliveredAt: Date | null; trackingCode: string | null }>;
}) {
  return `CONTEXT (real data for this user — only refer to what's here):

Reports uploaded: ${opts.reports}
Tradelines parsed: ${opts.tradelineCount}
Tradelines by bureau: ${Object.entries(opts.byBureau)
    .map(([b, n]) => `${b}=${n}`)
    .join(", ") || "none"}

Active disputes (${opts.disputes.length}):
${
  opts.disputes.length === 0
    ? "  none yet"
    : opts.disputes
        .map(
          (d) =>
            `  - case ${d.id.slice(0, 8)} · ${d.creditor ?? "packet"} · ${d.bureau ?? "—"} · status=${d.status} · reason=${d.reason.slice(0, 140)}`,
        )
        .join("\n")
}

Recent certified mail (${opts.mailJobs.length}):
${
  opts.mailJobs.length === 0
    ? "  none in flight"
    : opts.mailJobs
        .map(
          (j) =>
            `  - status=${j.status} · tracking=${j.trackingCode ?? "pending"} · delivered=${j.deliveredAt ? j.deliveredAt.toISOString().slice(0, 10) : "no"}`,
        )
        .join("\n")
}

End of CONTEXT.`;
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Pull the user's REAL state. This is the only ground truth the AI gets.
  const [reports, tradelines, disputes, mailJobs] = await Promise.all([
    prisma.creditReport.count({ where: { userId: user.id } }),
    prisma.tradeline.findMany({ where: { report: { userId: user.id } } }),
    prisma.disputeCase.findMany({
      where: { userId: user.id },
      include: { tradeline: true },
      orderBy: { id: "desc" },
      take: 12,
    }),
    prisma.mailJob.findMany({
      where: { disputeCase: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const byBureau: Record<string, number> = {};
  for (const t of tradelines) byBureau[t.bureau] = (byBureau[t.bureau] ?? 0) + 1;

  const context = buildContext({
    reports,
    tradelineCount: tradelines.length,
    byBureau,
    disputes: disputes.map((d) => ({
      id: d.id,
      status: d.status,
      reason: d.aiReasonSummary,
      bureau: d.tradeline?.bureau,
      creditor: d.tradeline?.creditorName,
    })),
    mailJobs: mailJobs.map((j) => ({
      status: j.status,
      deliveredAt: j.deliveredAt,
      trackingCode: j.trackingCode,
    })),
  });

  const transcript = parsed.data.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const result = await callClaude({
    model: "haiku",
    system: SYSTEM,
    user: `${context}\n\nCONVERSATION:\n${transcript}`,
    maxTokens: 600,
    temperature: 0.3,
  });

  await writeAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    action: "AI_ASSISTANT_QUERY",
    entityType: "User",
    entityId: user.id,
    metadataJson: { live: result.live, contextItems: tradelines.length },
  }).catch(() => null);

  return NextResponse.json({ reply: result.text, live: result.live });
}
