import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decrypt } from "@/lib/encryption";
import { redactJson } from "@/lib/credit-import/redact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  try {
    const result = await fetchQuery(
      api.creditImports.adminGet,
      { id: id as Id<"creditReportImports"> },
      { token: token ?? undefined },
    );
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({
      import: {
        ...result.import,
        user: result.user,
        raw: result.raw,
        normalized: result.normalized,
        tradelines: result.tradelines,
        inquiries: result.inquiries,
        collections: result.collections,
        publicRecords: result.publicRecords,
        scoreSnapshots: result.scoreSnapshots,
        personalProfiles: result.personalProfiles,
        disputeCandidates: result.disputeCandidates,
      },
    });
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}

/**
 * Decrypt + return the raw JSON for admin inspection. The response is
 * redacted: SSNs, DOBs, account numbers, phones, emails are masked before
 * the body leaves the server.
 */
export async function POST(req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "inspect-raw") {
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  }

  try {
    const result = await fetchQuery(
      api.creditImports.adminGetRaw,
      { id: id as Id<"creditReportImports"> },
      { token: token ?? undefined },
    );
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!result.raw) return NextResponse.json({ error: "NO_RAW" }, { status: 404 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypt(result.raw.encryptedPayload));
    } catch (err) {
      return NextResponse.json(
        { error: "DECRYPT_FAILED", message: (err as Error).message },
        { status: 500 },
      );
    }

    await fetchMutation(
      api.creditImports.writeRawInspectedAudit,
      {
        importId: id as Id<"creditReportImports">,
        payloadHash: result.raw.payloadHash,
      },
      { token: token ?? undefined },
    );

    return NextResponse.json({
      redacted: true,
      raw: redactJson(parsed),
      payloadBytes: result.raw.payloadBytes,
      payloadHash: result.raw.payloadHash,
    });
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
