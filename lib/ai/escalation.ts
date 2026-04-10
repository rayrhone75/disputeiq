// Escalation letter drafters — each stage has a distinct system prompt grounded
// in the user's real dispute timeline. Never promises removals.
import { callClaude } from "./client";

interface EscalationContext {
  consumer: { fullName: string; address1: string; city: string; state: string; zip: string };
  creditor: string;
  accountRefMasked: string;
  bureau: string;
  priorCaseId: string;
  priorReason: string;
  priorMailedAt?: string;
  priorDeliveredAt?: string;
  balanceCents?: number | null;
  statusLabel?: string | null;
}

export interface EscalationResult {
  bodyText: string;
  legalBasis: string;
  aiLive: boolean;
  stage: string;
}

function formatCtx(ctx: EscalationContext): string {
  return `CONSUMER: ${ctx.consumer.fullName}, ${ctx.consumer.address1}, ${ctx.consumer.city}, ${ctx.consumer.state} ${ctx.consumer.zip}
CREDITOR: ${ctx.creditor}
ACCOUNT: ${ctx.accountRefMasked}
BUREAU: ${ctx.bureau}
BALANCE: ${ctx.balanceCents != null ? `$${(ctx.balanceCents / 100).toFixed(2)}` : "not reported"}
STATUS: ${ctx.statusLabel ?? "not reported"}
PRIOR DISPUTE CASE: ${ctx.priorCaseId}
PRIOR REASON: ${ctx.priorReason}
PRIOR MAILED: ${ctx.priorMailedAt ?? "unknown"}
PRIOR DELIVERED: ${ctx.priorDeliveredAt ?? "unknown"}`;
}

// Round 2 — Re-dispute / reinvestigation request
export async function draftRedispute(ctx: EscalationContext): Promise<EscalationResult> {
  const ai = await callClaude({
    model: "opus",
    system: `You are a paralegal drafting a SECOND-ROUND reinvestigation demand under FCRA §611. Rules:
(1) Reference the prior dispute by case ID and dates.
(2) State that the bureau failed to conduct a reasonable investigation as required.
(3) Highlight specific inconsistencies from the prior dispute reason.
(4) Demand reinvestigation within 30 days.
(5) Do NOT promise removal. Do NOT threaten litigation.
(6) Use ONLY the facts provided. Do NOT invent dates, balances, or case numbers.
(7) Formal, firm, professional tone.
(8) Output ONLY the letter body — no address block, date, or salutation.`,
    user: `STAGE: RE-DISPUTE (Round 2)\nLEGAL BASIS: FCRA §611 (15 U.S.C. §1681i)\n\n${formatCtx(ctx)}`,
    maxTokens: 1200,
  });
  return {
    bodyText: ai.text.trim(),
    legalBasis: "FCRA §611 (15 U.S.C. §1681i) — reinvestigation demand",
    aiLive: ai.live,
    stage: "redispute",
  };
}

// Round 3 — Method of Verification request
export async function draftMOV(ctx: EscalationContext): Promise<EscalationResult> {
  const ai = await callClaude({
    model: "opus",
    system: `You are a paralegal drafting a Method of Verification (MOV) request under FCRA §611(a)(6)(B)(iii). Rules:
(1) Reference the prior dispute and its result.
(2) Demand the bureau disclose: who they contacted, what documents were reviewed, and the procedure used to verify the item.
(3) Cite §611(a)(7) regarding reinsertion requirements.
(4) Note that failure to provide the method of verification may constitute a violation.
(5) Do NOT promise removal or threaten litigation.
(6) Use ONLY the facts provided.
(7) Formal, firm tone.
(8) Output ONLY the letter body.`,
    user: `STAGE: METHOD OF VERIFICATION (Round 3)\nLEGAL BASIS: FCRA §611(a)(6)(B)(iii)\n\n${formatCtx(ctx)}`,
    maxTokens: 1200,
  });
  return {
    bodyText: ai.text.trim(),
    legalBasis: "FCRA §611(a)(6)(B)(iii) — method of verification request",
    aiLive: ai.live,
    stage: "mov",
  };
}

// CFPB Complaint
export async function draftCFPB(ctx: EscalationContext & {
  disputeTimeline: Array<{ date: string; action: string; result: string }>;
}): Promise<EscalationResult> {
  const timeline = ctx.disputeTimeline
    .map((e, i) => `${i + 1}. ${e.date} — ${e.action}: ${e.result}`)
    .join("\n");

  const ai = await callClaude({
    model: "opus",
    system: `You are a paralegal drafting a consumer complaint to the Consumer Financial Protection Bureau (CFPB). Rules:
(1) Summarize the full dispute timeline provided.
(2) Explain the consumer's issue clearly: the item is inaccurate, the bureau was notified, and the issue remains unresolved.
(3) Include the consumer impact: inability to obtain fair credit terms.
(4) Reference FCRA §611 and the bureau's obligation to investigate.
(5) Do NOT threaten, accuse of fraud, or promise any outcome.
(6) Use ONLY the facts provided.
(7) Professional, factual tone appropriate for a regulatory complaint.
(8) Output ONLY the complaint body text.`,
    user: `STAGE: CFPB COMPLAINT\nLEGAL BASIS: 12 CFR §1022 / FCRA §611\n\n${formatCtx(ctx)}\n\nDISPUTE TIMELINE:\n${timeline}`,
    maxTokens: 1500,
  });
  return {
    bodyText: ai.text.trim(),
    legalBasis: "12 CFR §1022 / FCRA §611 — CFPB complaint",
    aiLive: ai.live,
    stage: "cfpb",
  };
}

// Direct Furnisher / Creditor letter
export async function draftDirectFurnisher(ctx: EscalationContext): Promise<EscalationResult> {
  const ai = await callClaude({
    model: "opus",
    system: `You are a paralegal drafting a direct letter to the data furnisher (creditor or collector) under FCRA §623(b). Rules:
(1) Notify the furnisher that the consumer has disputed this account with the credit bureau.
(2) Reference the prior dispute and its case ID.
(3) Request that the furnisher conduct its own investigation as required by §623(b).
(4) Request validation documentation for the reported balance, status, and dates.
(5) Include the dispute history summary.
(6) Do NOT threaten litigation or promise any outcome.
(7) Use ONLY the facts provided.
(8) Formal, professional tone.
(9) Output ONLY the letter body.`,
    user: `STAGE: DIRECT FURNISHER LETTER\nLEGAL BASIS: FCRA §623(b) (15 U.S.C. §1681s-2(b))\n\n${formatCtx(ctx)}`,
    maxTokens: 1200,
  });
  return {
    bodyText: ai.text.trim(),
    legalBasis: "FCRA §623(b) (15 U.S.C. §1681s-2(b)) — furnisher investigation duty",
    aiLive: ai.live,
    stage: "direct_furnisher",
  };
}
