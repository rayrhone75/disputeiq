import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { callClaude } from "@/lib/ai/client";
import { writeAuditLog } from "@/lib/audit";

// Authenticated, context-grounded AI assistant for the dashboard.
// The model receives a structured snapshot of THIS USER's real report state,
// dispute history, and mail status. It is forbidden from inventing facts or
// quoting tradelines that are not in the snapshot.

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
  disputes: Array<{
    id: string;
    status: string;
    reason: string;
    bureau?: string;
    creditor?: string;
  }>;
  mailJobs: Array<{
    status: string;
    deliveredAt: number | null;
    trackingCode: string | null;
  }>;
}) {
  return `CONTEXT (real data for this user — only refer to what's here):

Reports uploaded: ${opts.reports}
Tradelines parsed: ${opts.tradelineCount}
Tradelines by bureau: ${
    Object.entries(opts.byBureau)
      .map(([b, n]) => `${b}=${n}`)
      .join(", ") || "none"
  }

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
            `  - status=${j.status} · tracking=${j.trackingCode ?? "pending"} · delivered=${j.deliveredAt ? new Date(j.deliveredAt).toISOString().slice(0, 10) : "no"}`,
        )
        .join("\n")
}

End of CONTEXT.`;
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // Pull the user's REAL state via the consolidated dashboard query.
  const overview = await fetchQuery(
    api.onboarding.dashboardOverview,
    {},
    { token },
  );
  if (!overview) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const tradelines = overview.tradelines;
  const byBureau: Record<string, number> = {};
  for (const t of tradelines) byBureau[t.bureau] = (byBureau[t.bureau] ?? 0) + 1;

  const context = buildContext({
    reports: overview.reports.length,
    tradelineCount: tradelines.length,
    byBureau,
    disputes: overview.disputes.slice(0, 12).map((d) => ({
      id: d._id as unknown as string,
      status: d.status,
      reason: d.aiReasonSummary,
      bureau: d.tradeline?.bureau,
      creditor: d.tradeline?.creditorName,
    })),
    mailJobs: overview.mailJobs.slice(0, 8).map((j) => ({
      status: j.status,
      deliveredAt: j.deliveredAt ?? null,
      trackingCode: j.trackingCode ?? null,
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
    action: "AI_ASSISTANT_QUERY",
    entityType: "User",
    entityId: overview.user.id as unknown as string,
    metadataJson: { live: result.live, contextItems: tradelines.length },
  }).catch(() => null);

  return NextResponse.json({ reply: result.text, live: result.live });
}
