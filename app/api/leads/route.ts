import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().min(1),
  topic: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const body = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : null;
  const referralCode = req.cookies.get("diq_ref")?.value ?? null;

  const lead = await prisma.lead.create({
    data: {
      email: body.email,
      fullName: body.fullName,
      phone: body.phone,
      source: body.source,
      topic: body.topic,
      referralCode,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      ipHash,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  });

  await writeAuditLog({
    action: "LEAD_CAPTURED",
    entityType: "Lead",
    entityId: lead.id,
    metadataJson: { source: body.source, topic: body.topic, referralCode },
  }).catch(() => null);

  if (referralCode) {
    await prisma.referral
      .update({ where: { code: referralCode }, data: { signups: { increment: 1 } } })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, id: lead.id });
}
