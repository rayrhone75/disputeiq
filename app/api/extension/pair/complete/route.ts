import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  signExtensionToken,
  verifyExtensionToken,
  hashToken,
} from "@/lib/auth/extension-token";
import { writeAuditLog } from "@/lib/audit";

// Step 2 of pairing — called by the extension popup with the full
// pair-token the user pasted. Swaps it for a long-lived extension-token
// (90 days). Records a `extensionPairings` row keyed by SHA-256 of the
// extension-token. The raw token is returned exactly once and lives only
// in chrome.storage on the user's machine.
//
// CORS: extension origin is `chrome-extension://<id>` (the id varies in
// dev vs prod). For Phase 1 we accept Origin: *  (the request requires
// a valid pair-token anyway, so an origin check adds little). When the
// extension is published with a stable Web Store id, we can lock CORS
// to that id.

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(_req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: {
    pairToken?: string;
    extensionVersion?: string;
    userAgent?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON" },
      { status: 400, headers: corsHeaders() },
    );
  }

  if (!body.pairToken) {
    return NextResponse.json(
      { error: "MISSING_PAIR_TOKEN" },
      { status: 400, headers: corsHeaders() },
    );
  }

  // 1. Verify the pair-token. Must be exactly the right purpose;
  //    purpose-binding prevents replaying an extension-token here.
  const verify = verifyExtensionToken(body.pairToken, "extension-pair");
  if (!verify.ok) {
    return NextResponse.json(
      { error: verify.code, message: verify.message },
      { status: 401, headers: corsHeaders() },
    );
  }
  const clerkUserId = verify.payload.uid;
  const pairJti = verify.payload.jti;

  // 2. Issue the long-lived extension-token.
  const issued = signExtensionToken({
    clerkUserId,
    purpose: "extension-token",
    pairId: pairJti,
  });

  // 3. Resolve Convex user, create pairing row keyed by SHA-256 of
  //    the new extension-token.
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      { error: "SERVER_NOT_CONFIGURED" },
      { status: 500, headers: corsHeaders() },
    );
  }
  const convexUser = await fetchQuery(api.users.byClerkIdAsService, {
    secret,
    clerkUserId,
  });
  if (!convexUser) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message:
          "DisputeIQ user not found. Sign in to disputeiq.org once first.",
      },
      { status: 404, headers: corsHeaders() },
    );
  }

  let pairingId: Id<"extensionPairings">;
  try {
    pairingId = (await fetchMutation(
      api.extensionPairings.createPairing,
      {
        secret,
        userId: convexUser._id,
        tokenHash: hashToken(issued.token),
        pairJti,
        extensionVersion: body.extensionVersion?.slice(0, 32),
        userAgent: body.userAgent?.slice(0, 500),
        expiresAt: issued.payload.exp * 1000,
      },
    )) as Id<"extensionPairings">;
  } catch (err) {
    return NextResponse.json(
      {
        error: "PAIR_PERSIST_FAILED",
        message: (err as Error).message,
      },
      { status: 500, headers: corsHeaders() },
    );
  }

  await writeAuditLog({
    actorUserId: clerkUserId,
    targetUserId: clerkUserId,
    action: "EXTENSION_PAIRING_COMPLETED",
    entityType: "ExtensionPairing",
    entityId: pairingId as unknown as string,
    metadataJson: {
      extensionVersion: body.extensionVersion ?? null,
    },
  }).catch(() => null);

  // 4. Return the long-lived extension-token. Also surface a tiny user
  //    profile so the popup can render "Hi, you@example.com".
  return NextResponse.json(
    {
      ok: true,
      extensionToken: issued.token,
      expiresAt: issued.payload.exp * 1000,
      ttlSeconds: 90 * 24 * 60 * 60,
      user: {
        email: convexUser.email,
      },
      pairingId,
    },
    { status: 200, headers: corsHeaders() },
  );
}
