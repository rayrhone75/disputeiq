import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { MailJobStatus } from "@/lib/letterstream/status";
import { classifyEventKind } from "@/lib/letterstream/status";
import { getSignature } from "@/lib/letterstream";

// LetterStream status webhook.
//
// Documented POST body fields:
//   - key          provider-assigned callback key
//   - api_version  callback schema version
//   - timestamp    provider-issued timestamp
//   - json         stringified JSON containing tracking line items
//
// We parse `json`, iterate tracking line items, and for each one:
//   - look up the matching MailJob via `api.mailJobs.recordEventFromWebhook`
//     (gated by INTERNAL_SERVICE_SECRET)
//   - record an append-only event + advance state
//   - on DELIVERED, update the dispute case (handled inside Convex)
//
// On signature events we additionally fetch the signature image ref via
// the provider tracking API before recording the event.
//
// Must respond HTTP 200 with {"success":true,"reason":"Received data"}.

export const runtime = "nodejs";

function mapStatus(raw?: string): MailJobStatus | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("deliver")) return "DELIVERED";
  if (s.includes("mail")) return "MAILED";
  if (s.includes("print")) return "PRINTED";
  if (s.includes("accept")) return "ACCEPTED";
  if (s.includes("submit")) return "SUBMITTED";
  if (s.includes("fail") || s.includes("error")) return "FAILED";
  return null;
}

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({} as Record<string, unknown>));
    return j && typeof j === "object" ? (j as Record<string, string>) : {};
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

function pickId(item: Record<string, unknown>): string | undefined {
  const v =
    item.job_id ??
    item.jobid ??
    item.JobID ??
    item.id ??
    item.uniqueid ??
    item.UniqueID ??
    item.batch_id ??
    item.batchid ??
    item.BatchID;
  return v == null ? undefined : String(v);
}

function pickStatus(item: Record<string, unknown>): string | undefined {
  const v = item.status ?? item.Status ?? item.event ?? item.state ?? item.tracking_status;
  return v == null ? undefined : String(v);
}

function pickTrackingCode(item: Record<string, unknown>): string | undefined {
  const v =
    item.tracking_number ??
    item.tracking ??
    item.usps_tracking ??
    item.TrackingNumber;
  return v == null ? undefined : String(v);
}

const ACK = { success: true, reason: "Received data" };

function internalSecret(): string | null {
  return process.env.INTERNAL_SERVICE_SECRET ?? null;
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);

  const { key, api_version: apiVersion, timestamp, json: jsonStr } = body;

  const expected = process.env.LETTERSTREAM_CALLBACK_KEY;
  const secret = internalSecret();

  if (expected && key !== expected) {
    if (secret) {
      await fetchMutation(api.mailJobs.recordBadCallbackKey, {
        secret,
        apiVersion,
        timestamp,
      }).catch(() => null);
    }
    // Always ACK — never give a webhook reason to retry-storm us.
    return NextResponse.json(ACK);
  }

  if (!secret) {
    // Misconfiguration: ACK to LetterStream but log to console so we notice.
    console.error(
      "[letterstream/webhook] INTERNAL_SERVICE_SECRET unset — events will be dropped.",
    );
    return NextResponse.json(ACK);
  }

  let items: Record<string, unknown>[] = [];
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) items = parsed;
      else if (Array.isArray((parsed as { items?: unknown[] }).items))
        items = (parsed as { items: Record<string, unknown>[] }).items;
      else if (Array.isArray((parsed as { tracking?: unknown[] }).tracking))
        items = (parsed as { tracking: Record<string, unknown>[] }).tracking;
      else items = [parsed];
    } catch {
      items = [];
    }
  }

  for (const item of items) {
    const providerId = pickId(item);
    if (!providerId) continue;

    const rawStatus = pickStatus(item);
    const mapped = mapStatus(rawStatus);
    const trackingCode = pickTrackingCode(item);

    // For DELIVERED + ERR-tracked packets, attempt to fetch the signature
    // image ref before we record the event so it lands on the same row.
    let signatureRef: string | undefined;
    let signedAt: number | undefined;
    if (mapped === "DELIVERED") {
      try {
        const sig = await getSignature(String(providerId));
        const ref =
          (sig as { url?: string; signature_url?: string; ref?: string })?.url ??
          (sig as { signature_url?: string })?.signature_url ??
          (sig as { ref?: string })?.ref ??
          null;
        if (ref) {
          signatureRef = String(ref);
          signedAt = Date.now();
        }
      } catch {
        // Best-effort — Convex will still record the DELIVERED event itself.
      }
    }

    await fetchMutation(api.mailJobs.recordEventFromWebhook, {
      secret,
      providerJobId: String(providerId),
      rawStatus,
      mappedStatus: mapped ?? undefined,
      eventKind: classifyEventKind(rawStatus),
      trackingCode,
      signatureRef,
      signedAt,
      payloadJson: item,
      apiVersion,
      timestamp,
    }).catch((e) => {
      console.warn("[letterstream/webhook] convex mutation failed", e);
      return null;
    });
  }

  return NextResponse.json(ACK);
}

// LetterStream POSTs only. Return 405 for anything else (fixes the 405 we saw
// when a browser GET hit this endpoint).
export function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
