import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Referral landing route. Sets a 60-day cookie tying subsequent leads/signups
// to the referral code, then redirects to the marketing homepage.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const ref = await prisma.referral.findUnique({ where: { code } }).catch(() => null);
  const url = new URL("/", _req.url);
  const res = NextResponse.redirect(url);
  if (ref) {
    await prisma.referral
      .update({ where: { id: ref.id }, data: { clicks: { increment: 1 } } })
      .catch(() => null);
    res.cookies.set("diq_ref", code, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 60,
      path: "/",
    });
  }
  return res;
}
