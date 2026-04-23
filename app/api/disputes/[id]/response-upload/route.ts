import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { parseReportPdf } from "@/lib/report-parser";
import { callClaude } from "@/lib/ai/client";
import { writeAuditLog } from "@/lib/audit";

// User uploads the bureau's response letter (PDF). We parse the text content,
// send it to Claude haiku with a strict response-classification prompt, and
// return a recommendation: re-dispute, escalate (CFPB), or accept as resolved.
// The parsed response bytes are stored in secure storage as a CaseAttachment.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;

  const dc = await prisma.disputeCase.findUnique({ where: { id } });
  if (!dc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (dc.userId !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const ref = await storage.put(
    `responses/${user.id}/${hash}.pdf`,
    buf,
    "application/pdf",
  );

  const attachment = await prisma.caseAttachment.create({
    data: {
      disputeCaseId: id,
      kind: "BUREAU_RESPONSE",
      secureFileRef: ref,
    },
  });

  // Extract raw text so the AI can classify the response.
  let responseText = "";
  try {
    const parsed = await parseReportPdf(buf);
    responseText = (parsed as any).rawText ?? JSON.stringify(parsed).slice(0, 6000);
  } catch {
    responseText = "(could not extract text — PDF may be image-only)";
  }

  const ai = await callClaude({
    model: "haiku",
    system:
      "You are a paralegal classifying a consumer credit bureau's response to an FCRA dispute. Read the bureau's letter and output a short JSON object with these fields: {\"classification\": one of [\"verified\",\"updated\",\"deleted\",\"stall\",\"no_investigation\",\"unclear\"], \"reasoning\": one sentence, \"recommendation\": one of [\"accept_as_resolved\",\"re_dispute\",\"escalate_cfpb\"]}. Do NOT invent facts. If the letter text is unclear or unreadable, use classification=\"unclear\" and recommendation=\"re_dispute\".",
    user: responseText.slice(0, 8000),
    maxTokens: 400,
    temperature: 0.1,
  });

  const verdict = extractVerdict(ai.text);

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: "BUREAU_RESPONSE_UPLOADED",
    entityType: "DisputeCase",
    entityId: id,
    metadataJson: {
      ref,
      attachmentId: attachment.id,
      aiLive: ai.live,
      classification: verdict.classification,
      recommendation: verdict.recommendation,
      reasoning: verdict.reasoning,
    },
  });

  return NextResponse.json({
    attachmentId: attachment.id,
    analysis: ai.text,
    verdict,
    aiLive: ai.live,
  });
}

type Verdict = {
  classification:
    | "verified"
    | "updated"
    | "deleted"
    | "stall"
    | "no_investigation"
    | "unclear";
  recommendation: "accept_as_resolved" | "re_dispute" | "escalate_cfpb";
  reasoning: string;
};

const VALID_CLASS = new Set([
  "verified",
  "updated",
  "deleted",
  "stall",
  "no_investigation",
  "unclear",
]);
const VALID_REC = new Set(["accept_as_resolved", "re_dispute", "escalate_cfpb"]);

function extractVerdict(raw: string): Verdict {
  const fallback: Verdict = {
    classification: "unclear",
    recommendation: "re_dispute",
    reasoning: "Could not parse AI output.",
  };
  if (!raw) return fallback;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]);
    const classification = VALID_CLASS.has(parsed.classification)
      ? parsed.classification
      : "unclear";
    const recommendation = VALID_REC.has(parsed.recommendation)
      ? parsed.recommendation
      : "re_dispute";
    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
        ? parsed.reasoning.slice(0, 400)
        : "No reasoning provided.";
    return { classification, recommendation, reasoning } as Verdict;
  } catch {
    return fallback;
  }
}
