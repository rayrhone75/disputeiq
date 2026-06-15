// Bridge: connector-fetched report → normalized preview + save draft.
//
// Reuses the canonical processCreditReport pipeline (OCR/HTML → AI
// paralegal → MyScoreIQ-shape JSON) so connector imports produce exactly
// the same data shape as manual uploads. This module is Convex-free: it
// returns a draft the API route persists via the existing runner.

import { processCreditReport } from "../process-report";
import type { ConnectorFetchResult } from "./types";
import type { ConnectorProviderId } from "./config";
import type { VhParalegalJson } from "../ai-paralegal";

export type ConnectorPreview = {
  provider: ConnectorProviderId;
  confidence: string;
  counts: {
    tradelines: number;
    inquiries: number;
    collections: number;
    publicRecords: number;
  };
  consumerName: string | null;
  sampleCreditors: string[];
  reasonCodes: string[];
};

export type ConnectorDraft = {
  // MyScoreIQ-shape JSON the runner persists + normalizes.
  myscoreiqJson: unknown;
  // VH-shape paralegal output for the per-bureau-column UI.
  paralegal: VhParalegalJson;
};

export type ProcessConnectorResult = {
  preview: ConnectorPreview;
  draft: ConnectorDraft;
};

function toProcessInput(fetched: ConnectorFetchResult) {
  switch (fetched.kind) {
    case "html":
      return { format: "html" as const, bytes: Buffer.from(fetched.html, "utf8") };
    case "pdf":
      return {
        format: "pdf" as const,
        bytes: fetched.pdf,
        filename: fetched.filename,
      };
    case "text":
      return { format: "text" as const, text: fetched.text };
  }
}

export async function processConnectorReport(
  provider: ConnectorProviderId,
  fetched: ConnectorFetchResult,
  onStage?: (event: string, data?: Record<string, unknown>) => void,
): Promise<ProcessConnectorResult> {
  const outcome = await processCreditReport(toProcessInput(fetched), {
    logStage: (event, data) => onStage?.(`process:${event}`, data),
  });

  const p = outcome.paralegal;
  const counts = {
    tradelines: outcome.result.counts.tradelines ?? p.accounts?.length ?? 0,
    inquiries: p.inquiries?.length ?? 0,
    collections: p.collections?.length ?? 0,
    publicRecords: p.public_records?.length ?? 0,
  };

  const consumerName =
    (p.consumer as { name?: string } | undefined)?.name ?? null;

  const sampleCreditors = (p.accounts ?? [])
    .map(
      (a) =>
        (a as { creditor?: string; creditor_name?: string }).creditor ??
        (a as { creditor_name?: string }).creditor_name ??
        "",
    )
    .filter(Boolean)
    .slice(0, 6);

  return {
    preview: {
      provider,
      confidence: outcome.result.confidence,
      counts,
      consumerName,
      sampleCreditors,
      reasonCodes: outcome.result.reasonCodes ?? [],
    },
    draft: {
      myscoreiqJson: outcome.result.json,
      paralegal: p,
    },
  };
}
