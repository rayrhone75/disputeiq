import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Get-or-create the calling user's referral code.
export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const existing = await prisma.referral.findFirst({ where: { ownerUserId: user.id } });
  if (existing) {
    return NextResponse.json({ code: existing.code, stats: existing });
  }

  const code = crypto.randomBytes(4).toString("hex");
  const ref = await prisma.referral.create({ data: { code, ownerUserId: user.id } });
  return NextResponse.json({ code: ref.code, stats: ref });
}

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const ref = await prisma.referral.findFirst({ where: { ownerUserId: user.id } });
  if (!ref) return NextResponse.json({ code: null });
  return NextResponse.json({ code: ref.code, stats: ref });
}
