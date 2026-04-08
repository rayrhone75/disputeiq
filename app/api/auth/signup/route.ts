import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  disclosuresAccepted: z.literal(true),
  affiliateDisclosureAccepted: z.literal(true),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: "USER",
      consentReceipts: {
        create: [
          { consentType: "DISCLOSURES", version: "1.0" },
          { consentType: "AFFILIATE_DISCLOSURE", version: "1.0" },
        ],
      },
    },
  });

  await writeAuditLog({
    targetUserId: user.id,
    action: "USER_SIGNUP",
    entityType: "User",
    entityId: user.id,
    metadataJson: {},
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
