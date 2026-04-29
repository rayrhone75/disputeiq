import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  signExtensionToken,
  deriveDisplayCodeFromJti,
  PAIR_TTL_SEC,
} from "@/lib/auth/extension-token";
import { writeAuditLog } from "@/lib/audit";

// Step 1 of the extension pairing flow.
// Customer clicks "Pair Extension" on /dashboard/get-report. This route:
//   - Requires a Clerk session (the user must be signed in).
//   - Issues a signed pair-token (purpose=extension-pair, 5-min TTL).
//   - Returns the full token PLUS a 6-letter display code derived from
//     the token's jti, which the dashboard surfaces to the user.
//
// The user pastes the 6-letter code into the extension popup. The
// popup's pair-complete call needs the FULL token, not the code; we
// pass it via a signed cookie / postMessage from the dashboard, OR
// the popup asks the dashboard to deep-link the full token. For now
// the simpler path is: dashboard shows full token AND code; user
// pastes either; popup can complete with full token directly.
//
// Why both code + token? The 6-letter code is for humans (paste over
// the phone, screenshot to support). The full token is the actual
// auth artifact. The popup can accept the full token directly so we
// don't need a back-end "code → token" lookup table; the code is
// just a display-friendly hash of jti.
export async function POST(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let token: string;
  let displayCode: string;
  let expiresAt: number;
  try {
    const signed = signExtensionToken({
      clerkUserId: userId,
      purpose: "extension-pair",
    });
    token = signed.token;
    displayCode = deriveDisplayCodeFromJti(signed.payload.jti);
    expiresAt = signed.payload.exp * 1000;
  } catch (err) {
    return NextResponse.json(
      { error: "TOKEN_SIGN_FAILED", message: (err as Error).message },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorUserId: userId,
    targetUserId: userId,
    action: "EXTENSION_PAIR_TOKEN_ISSUED",
    entityType: "User",
    entityId: userId,
    metadataJson: { displayCode, ttlSec: PAIR_TTL_SEC },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    pairToken: token,
    displayCode,
    expiresAt,
    ttlSeconds: PAIR_TTL_SEC,
  });
}
