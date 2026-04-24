import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Builds a timeline view of a dispute case from the case state + audit log.
// Read-only — no compliance gates required, but Convex still scopes to the
// caller via `requireUser` inside the query.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await ctx.params;
  const bundle = await fetchQuery(
    api.disputes.auditLogsForCase,
    { id: id as Id<"disputeCases"> },
    { token },
  );
  if (!bundle) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const dc = bundle.case;
  const events = [
    { at: dc.userConfirmedAt, label: "User confirmed", kind: "confirm" },
    { at: dc.mailedAt, label: "Mailed via certified mail", kind: "mailed" },
    { at: dc.deliveredAt, label: "Delivered", kind: "delivered" },
    { at: dc.responseDueAt, label: "Response due", kind: "due" },
  ].filter((e) => !!e.at);

  return NextResponse.json({
    case: {
      id: dc._id,
      status: dc.status,
      letterType: dc.letterType,
      aiReasonSummary: dc.aiReasonSummary,
    },
    events,
    auditLog: bundle.auditLogs.map((l) => ({
      at: l.createdAt,
      action: l.action,
      metadata: l.metadataJson,
    })),
  });
}
