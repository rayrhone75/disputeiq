import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { MailJobStatus } from "@prisma/client";
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
// We parse `json`, iterate tracking line items, match each to a MailJob by
// provider job id, record an append-only MailJobEvent, advance MailJob state,
// and on DELIVERED update the DisputeCase. On SIGNATURE we fetch the signature
// image ref via the provider tracking API.
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
  const v = item.tracking_number ?? item.tracking ?? item.usps_tracking ?? item.TrackingNumber;
  return v == null ? undefined : String(v);
}

const ACK = { success: true, reason: "Received data" };

export async function POST(req: NextRequest) {
  const body = await parseBody(req);

  const { key, api_version: apiVersion, timestamp, json: jsonStr } = body;

  const expected = process.env.LETTERSTREAM_CALLBACK_KEY;
  if (expected && key !== expected) {
    await writeAuditLog({
      action: "LETTERSTREAM_CALLBACK_BAD_KEY",
      entityType: "MailJob",
      entityId: "unknown",
      metadataJson: { apiVersion, timestamp },
    }).catch(() => null);
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

    const mailJob = await prisma.mailJob.findFirst({
      where: { providerJobId: String(providerId) },
    });

    if (!mailJob) {
      await writeAuditLog({
        action: "LETTERSTREAM_EVENT_UNMATCHED",
        entityType: "MailJob",
        entityId: String(providerId),
        metadataJson: { item, apiVersion, timestamp },
      }).catch(() => null);
      continue;
    }

    // Append-only event history.
    await prisma.mailJobEvent.create({
      data: {
        mailJobId: mailJob.id,
        kind: classifyEventKind(rawStatus),
        rawStatus: rawStatus ?? null,
        mappedStatus: mapped ?? null,
        message: null,
        payloadJson: item as object,
      },
    });

    // State advancement.
    if (mapped) {
      const now = new Date();
      const patch: {
        status: MailJobStatus;
        rawResponseJson: object;
        trackingCode?: string;
        mailedAt?: Date;
        deliveredAt?: Date;
        signedAt?: Date;
        signatureRef?: string;
      } = {
        status: mapped,
        rawResponseJson: item as object,
      };
      if (trackingCode && !mailJob.trackingCode) patch.trackingCode = trackingCode;
      if (mapped === "MAILED" && !mailJob.mailedAt) patch.mailedAt = now;
      if (mapped === "DELIVERED" && !mailJob.deliveredAt) patch.deliveredAt = now;

      // Fetch signature ref on delivery when ERR is enabled.
      if (mapped === "DELIVERED" && mailJob.err && !mailJob.signatureRef) {
        try {
          const sig = await getSignature(mailJob.providerJobId ?? "");
          const sigRef =
            (sig as { url?: string; signature_url?: string; ref?: string })?.url ??
            (sig as { signature_url?: string })?.signature_url ??
            (sig as { ref?: string })?.ref ??
            null;
          if (sigRef) {
            patch.signatureRef = String(sigRef);
            patch.signedAt = now;
            await prisma.mailJobEvent.create({
              data: {
                mailJobId: mailJob.id,
                kind: "SIGNATURE",
                rawStatus: "signature_captured",
                mappedStatus: mapped,
                payloadJson: sig as object,
              },
            });
          }
        } catch (e) {
          await prisma.mailJobEvent.create({
            data: {
              mailJobId: mailJob.id,
              kind: "ERROR",
              message: `signature_fetch_failed: ${e instanceof Error ? e.message : String(e)}`,
            },
          });
        }
      }

      await prisma.mailJob.update({
        where: { id: mailJob.id },
        data: patch,
      });

      if (mapped === "DELIVERED") {
        await prisma.disputeCase.update({
          where: { id: mailJob.disputeCaseId },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
      }
    }

    await writeAuditLog({
      action: "LETTERSTREAM_EVENT",
      entityType: "MailJob",
      entityId: mailJob.id,
      metadataJson: { rawStatus, mapped, trackingCode, apiVersion, timestamp },
    }).catch(() => null);
  }

  return NextResponse.json(ACK);
}

// LetterStream POSTs only. Return 405 for anything else (fixes the 405 we saw
// when a browser GET hit this endpoint).
export function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}
