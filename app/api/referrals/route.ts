import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Get-or-create the calling user's referral code.
export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const code = crypto.randomBytes(4).toString("hex");
  const ref = await fetchMutation(
    api.referrals.getOrCreateForUser,
    { code },
    { token },
  );
  return NextResponse.json({ code: ref?.code ?? null, stats: ref });
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const ref = await fetchQuery(api.referrals.getMine, {}, { token });
  if (!ref) return NextResponse.json({ code: null });
  return NextResponse.json({ code: ref.code, stats: ref });
}
