import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { encrypt } from "@/lib/encryption";

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
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  // Encrypt PII in the Next.js layer; Convex never sees plaintext.
  await fetchMutation(
    api.profile.upsert,
    {
      fullName: b.fullName,
      encryptedDob: encrypt(b.dob),
      encryptedSsnLast4: encrypt(b.ssnLast4),
      encryptedAddress1: encrypt(b.address1),
      encryptedCity: encrypt(b.city),
      encryptedState: encrypt(b.state),
      encryptedZip: encrypt(b.zip),
      encryptedPhone: b.phone ? encrypt(b.phone) : undefined,
    },
    { token },
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const profile = await fetchQuery(api.profile.getMine, {}, { token });
  return NextResponse.json({
    hasProfile: !!profile,
    fullName: profile?.fullName ?? null,
  });
}
