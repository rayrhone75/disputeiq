import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  fullName: z.string().min(2).max(100),
  dob: z.string().min(6).max(10),
  ssnLast4: z.string().length(4),
  address1: z.string().min(3).max(200),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const existing = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  if (existing) {
    // Update
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        fullName: b.fullName,
        encryptedDob: encrypt(b.dob),
        encryptedSsnLast4: encrypt(b.ssnLast4),
        encryptedAddress1: encrypt(b.address1),
        encryptedCity: encrypt(b.city),
        encryptedState: encrypt(b.state),
        encryptedZip: encrypt(b.zip),
        encryptedPhone: b.phone ? encrypt(b.phone) : null,
      },
    });
  } else {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        fullName: b.fullName,
        encryptedDob: encrypt(b.dob),
        encryptedSsnLast4: encrypt(b.ssnLast4),
        encryptedAddress1: encrypt(b.address1),
        encryptedCity: encrypt(b.city),
        encryptedState: encrypt(b.state),
        encryptedZip: encrypt(b.zip),
        encryptedPhone: b.phone ? encrypt(b.phone) : null,
      },
    });
  }

  await writeAuditLog({
    targetUserId: user.id,
    actorUserId: user.id,
    action: existing ? "PROFILE_UPDATED" : "PROFILE_CREATED",
    entityType: "UserProfile",
    entityId: user.id,
    metadataJson: {},
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ hasProfile: !!profile, fullName: profile?.fullName ?? null });
}
