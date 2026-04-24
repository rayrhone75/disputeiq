import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Referral landing route. Sets a 60-day cookie tying subsequent leads/signups
// to the referral code, then redirects to the marketing homepage.
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url);

  const result = await fetchMutation(api.referrals.recordClick, { code }).catch(
    () => null,
  );
  if (result?.matched) {
    res.cookies.set("diq_ref", code, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 60,
      path: "/",
    });
  }
  return res;
}
