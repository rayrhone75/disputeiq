import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  verifyExtensionToken,
  hashToken,
} from "@/lib/auth/extension-token";

// Health check called by the extension on popup open / background tick.
// Confirms the stored extension-token is still valid + not revoked +
// resolves to an active pairing row. Cheap; safe to call often.

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(_req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const verify = verifyExtensionToken(token, "extension-token");
  if (!verify.ok) {
    return NextResponse.json(
      { ok: false, code: verify.code, message: verify.message },
      { status: 401, headers: corsHeaders() },
    );
  }

  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      { ok: false, code: "SERVER_NOT_CONFIGURED" },
      { status: 500, headers: corsHeaders() },
    );
  }

  const pairing = await fetchQuery(
    api.extensionPairings.lookupActiveByTokenHash,
    { secret, tokenHash: hashToken(token!) },
  ).catch(() => null);
  if (!pairing) {
    return NextResponse.json(
      {
        ok: false,
        code: "PAIRING_REVOKED_OR_MISSING",
        message:
          "This extension's pairing has been revoked or expired. Re-pair from the DisputeIQ dashboard.",
      },
      { status: 401, headers: corsHeaders() },
    );
  }

  // Touch lastUsedAt so admins see the extension is alive.
  await fetchMutation(api.extensionPairings.recordUsage, {
    secret,
    pairingId: pairing._id,
  }).catch(() => null);

  // Pull the email for display in the popup.
  const user = await fetchQuery(api.users.byClerkIdAsService, {
    secret,
    clerkUserId: verify.payload.uid,
  }).catch(() => null);

  return NextResponse.json(
    {
      ok: true,
      pairingId: pairing._id,
      pairedAt: pairing.pairedAt,
      expiresAt: pairing.expiresAt,
      lastImportAt: pairing.lastImportAt ?? null,
      lastError: pairing.lastError ?? null,
      user: user ? { email: user.email } : null,
    },
    { status: 200, headers: corsHeaders() },
  );
}
