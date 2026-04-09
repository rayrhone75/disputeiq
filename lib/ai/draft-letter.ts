// AI dispute-letter drafting. Claude-opus generates the body text from
// structured grounding (consumer info + tradeline facts + finding code).
// Never invents account numbers or balances.
import { callClaude } from "./client";

export interface DraftLetterInput {
  letterType:
    | "FACTUAL_DISPUTE"
    | "MOV_REQUEST"
    | "DIRECT_FURNISHER"
    | "IDENTITY_THEFT_605B"
    | "CFPB_PACKET";
  consumer: {
    fullName: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
  };
  recipientName: string; // bureau or furnisher
  account: {
    creditor: string;
    accountRefMasked: string;
    bureau: string;
    balanceCents?: number | null;
    statusLabel?: string | null;
  };
  findingCode: string;
  findingDetail: string;
}

export interface DraftLetterResult {
  bodyText: string;
  legalBasis: string;
  aiLive: boolean;
}

const LEGAL_BASIS: Record<DraftLetterInput["letterType"], string> = {
  FACTUAL_DISPUTE: "FCRA §611 (15 U.S.C. §1681i) — right to dispute inaccurate information.",
  MOV_REQUEST: "FCRA §611(a)(6)(B)(iii) — request for method of verification.",
  DIRECT_FURNISHER: "FCRA §623(b) (15 U.S.C. §1681s-2(b)) — furnisher investigation duty.",
  IDENTITY_THEFT_605B: "FCRA §605B (15 U.S.C. §1681c-2) — block of information resulting from identity theft.",
  CFPB_PACKET: "12 CFR §1022 — consumer complaint to the Consumer Financial Protection Bureau.",
};

export interface DraftPacketInput {
  letterType: DraftLetterInput["letterType"];
  consumer: DraftLetterInput["consumer"];
  recipientName: string;
  items: Array<{
    creditor: string;
    accountRefMasked: string;
    bureau: string;
    balanceCents?: number | null;
    statusLabel?: string | null;
    findingCode: string;
    findingDetail: string;
  }>;
}

// Packet letter — one envelope to one bureau covering many disputed items.
// This is the model the rest of the platform uses for pricing and dispatch:
// one packet = one DisputeCase = one LetterStream certified job, regardless of
// how many tradelines it covers.
export async function draftPacketLetter(input: DraftPacketInput): Promise<DraftLetterResult> {
  const legalBasis = LEGAL_BASIS[input.letterType];

  const itemBlock = input.items
    .map(
      (it, i) =>
        `${i + 1}. ${it.creditor} — account ${it.accountRefMasked} (reporting bureau: ${it.bureau})
   Balance: ${it.balanceCents != null ? `$${(it.balanceCents / 100).toFixed(2)}` : "not reported"}
   Status: ${it.statusLabel ?? "not reported"}
   Issue: ${it.findingCode} — ${it.findingDetail}`,
    )
    .join("\n\n");

  const grounding = `LETTER TYPE: ${input.letterType}
LEGAL BASIS: ${legalBasis}

CONSUMER:
${input.consumer.fullName}
${input.consumer.address1}
${input.consumer.city}, ${input.consumer.state} ${input.consumer.zip}

RECIPIENT: ${input.recipientName}

DISPUTED ITEMS (do not invent or alter — list every item below in the letter):
${itemBlock}`;

  const ai = await callClaude({
    model: "opus",
    system:
      "You are a paralegal drafting an FCRA dispute PACKET letter to a credit bureau. The letter covers multiple disputed accounts in one envelope. Rules: (1) Use ONLY the facts provided — never invent account numbers, balances, dates, or addresses. (2) Cite the legal basis exactly as given. (3) Open with a single short paragraph stating the purpose. (4) For EACH disputed item, write a short numbered paragraph that names the creditor, the masked account ref, the specific issue, and the requested remedy (deletion or correction). (5) Close with a demand for written response within 30 days and a request that all updated information be sent to the consumer at the address on file. (6) Do NOT include the consumer's address block, the date, or a salutation — those are added by the renderer. Output ONLY the letter body text.",
    user: grounding,
    maxTokens: 2500,
  });

  return { bodyText: ai.text.trim(), legalBasis, aiLive: ai.live };
}

export async function draftLetter(input: DraftLetterInput): Promise<DraftLetterResult> {
  const legalBasis = LEGAL_BASIS[input.letterType];

  const grounding = `LETTER TYPE: ${input.letterType}
LEGAL BASIS: ${legalBasis}

CONSUMER:
${input.consumer.fullName}
${input.consumer.address1}
${input.consumer.city}, ${input.consumer.state} ${input.consumer.zip}

RECIPIENT: ${input.recipientName}

ACCOUNT FACTS (do not invent or alter):
- Creditor: ${input.account.creditor}
- Account ref: ${input.account.accountRefMasked}
- Reporting bureau: ${input.account.bureau}
- Balance: ${input.account.balanceCents != null ? `$${(input.account.balanceCents / 100).toFixed(2)}` : "not reported"}
- Status: ${input.account.statusLabel ?? "not reported"}

FINDING:
- Code: ${input.findingCode}
- Detail: ${input.findingDetail}`;

  const ai = await callClaude({
    model: "opus",
    system:
      "You are a paralegal specializing in FCRA dispute letters. Write a formal, professional dispute letter body. Rules: (1) Use ONLY the facts provided — never invent account numbers, balances, dates, or addresses. (2) Cite the legal basis exactly as given. (3) Demand specific relief (deletion or correction). (4) Request a written response within 30 days. (5) Do NOT include the consumer's address block, the date, or a salutation — those are added by the renderer. Output ONLY the letter body text.",
    user: grounding,
    maxTokens: 1200,
  });

  return {
    bodyText: ai.text.trim(),
    legalBasis,
    aiLive: ai.live,
  };
}
