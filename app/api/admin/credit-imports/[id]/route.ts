import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { redactJson } from "@/lib/credit-import/redact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const imp = await prisma.creditReportImport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      raw: {
        select: {
          id: true,
          payloadBytes: true,
          payloadHash: true,
          redactionFingerprint: true,
          capturedAt: true,
        },
      },
      normalized: true,
      tradelines: true,
      inquiries: true,
      collections: true,
      publicRecords: true,
      scoreSnapshots: true,
      personalProfiles: true,
      disputeCandidates: true,
    },
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ import: imp });
}

/**
 * Decrypt + return the raw JSON for admin inspection. The response is
 * redacted: SSNs, DOBs, account numbers, phones, emails are masked before
 * the body leaves the server.
 */
export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "inspect-raw") {
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  }

  const raw = await prisma.creditReportRaw.findUnique({ where: { importId: id } });
  if (!raw) return NextResponse.json({ error: "NO_RAW" }, { status: 404 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypt(raw.encryptedPayload));
  } catch (err) {
    return NextResponse.json(
      { error: "DECRYPT_FAILED", message: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    redacted: true,
    raw: redactJson(parsed),
    payloadBytes: raw.payloadBytes,
    payloadHash: raw.payloadHash,
  });
}
