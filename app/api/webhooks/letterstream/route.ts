import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import type { MailJobStatus } from "@prisma/client";

// LetterStream status webhook. Updates the matching MailJob row and, when
// terminal, advances the linked DisputeCase. We try to be tolerant of field
// name variants until the exact account payload is locked in.
function mapStatus(raw?: string): MailJobStatus | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("deliver")) return "DELIVERED";
  if (s.includes("mail")) return "MAILED";
  if (s.includes("print")) return "PRINTED";
  if (s.includes("accept")) return "ACCEPTED";
  if (s.includes("submit")) return "SUBMITTED";
  if (s.includes("fail") || s.includes("error")) return "FAILED";
  return null;
}

export async function POST(req: NextRequest) {
  const event = await req.json().catch(() => ({} as any));

  const providerJobId: string | undefined =
    event?.job_id ?? event?.jobId ?? event?.id ?? event?.metadata?.providerJobId;
  const rawStatus: string | undefined = event?.status ?? event?.event ?? event?.state;
  const mailJobIdHint: string | undefined = event?.metadata?.mailJobId;
  const disputeCaseIdHint: string | undefined = event?.metadata?.disputeCaseId;

  const mapped = mapStatus(rawStatus);
  if (!providerJobId && !mailJobIdHint) {
    return NextResponse.json({ ok: true, ignored: "no identifier" });
  }

  const mailJob = await prisma.mailJob.findFirst({
    where: providerJobId ? { providerJobId } : { id: mailJobIdHint! },
  });

  if (!mailJob) {
    await writeAuditLog({
      action: "LETTERSTREAM_EVENT_UNMATCHED",
      entityType: "MailJob",
      entityId: providerJobId ?? mailJobIdHint ?? "unknown",
      metadataJson: { rawStatus, event },
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (mapped) {
    await prisma.mailJob.update({
      where: { id: mailJob.id },
      data: { status: mapped, rawResponseJson: event },
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
    metadataJson: { rawStatus, mapped, disputeCaseIdHint },
  });

  return NextResponse.json({ ok: true });
}
