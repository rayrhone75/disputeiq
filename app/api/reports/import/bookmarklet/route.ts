import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import {
  verifyBookmarkletToken,
  type VerifyErrorCode,
} from "@/lib/auth/bookmarklet-token";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import { writeAuditLog } from "@/lib/audit";

// MyScoreIQ bookmarklet import endpoint — same-origin Clerk-authed.
//
// The bookmarklet on member.myscoreiq.com cannot reach this endpoint
// directly (no Clerk session cookie travels cross-origin). Instead, the
// bookmarklet opens /import/relay in a new tab on disputeiq.org, hands the
// raw JSON over via postMessage, and the relay's client component POSTs
// {token, json} here as a same-origin Clerk-authed request.
//
// Auth model:
//   - Clerk session (cookie-derived) authenticates the active user.
//   - HMAC bookmarklet token binds the bookmarklet identity to the Clerk
//     userId. We reject if `token.uid !== clerk.userId` so a shared
//     bookmarklet cannot pollute a different account.
//
// Pipeline: identical to /api/reports/paste's JSON branch — uses only
// pre-existing Convex mutations with the user's Clerk JWT.

const Body = z.object({
  token: z.string().min(8).max(4096),
  json: z.string().min(2).max(25 * 1024 * 1024),
});

// Same reasoning as /api/reports/paste — large MSIQ JSONs + Convex
// round-trips need more than the 10s default.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Clerk session — must be present.
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Sign in to DisputeIQ first." },
      { status: 401 },
    );
  }

  // 2. Parse body.
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_BODY",
        message: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }
  const { token, json } = parsed.data;

  // 3. Verify HMAC bookmarklet token.
  const verify = verifyBookmarkletToken(token);
  if (!verify.ok) {
    await writeAuditLog({
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "User",
      entityId: userId,
      metadataJson: { stage: "verifyToken", code: verify.code },
    }).catch(() => null);
    return NextResponse.json(
      {
        ok: false,
        code: mapVerifyCode(verify.code),
        message: verify.message,
      },
      { status: 401 },
    );
  }
  if (verify.payload.uid !== userId) {
    await writeAuditLog({
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "User",
      entityId: userId,
      metadataJson: { stage: "uidBinding", tokenUid: verify.payload.uid },
    }).catch(() => null);
    return NextResponse.json(
      {
        ok: false,
        code: "TOKEN_USER_MISMATCH",
        message:
          "This bookmarklet was created for a different DisputeIQ account. Reinstall the bookmarklet from /dashboard/get-report.",
      },
      { status: 403 },
    );
  }

  // 4. Validate JSON shape (cheap pre-flight before encryption).
  const trimmed = json.trim();
  if (trimmed[0] !== "{" && trimmed[0] !== "[") {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_JSON",
        message:
          "Body does not look like JSON. The bookmarklet must run on the MyScoreIQ JSON report page.",
      },
      { status: 400 },
    );
  }
  try {
    JSON.parse(trimmed);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "PARSE_ERROR",
        message: `Invalid JSON: ${(err as Error).message}`,
      },
      { status: 400 },
    );
  }

  // 5. Get Convex JWT for this user.
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return NextResponse.json(
      {
        ok: false,
        code: "NO_CONVEX_TOKEN",
        message: "Could not mint Convex token. Sign out and sign back in.",
      },
      { status: 500 },
    );
  }

  // 6. Audit attempt (best-effort).
  await writeAuditLog({
    action: "BOOKMARKLET_IMPORT_ATTEMPT",
    entityType: "User",
    entityId: userId,
    metadataJson: { payloadBytes: Buffer.byteLength(trimmed, "utf8") },
  }).catch(() => null);

  // 7. Run pipeline — exact same call shape as /api/reports/paste's JSON
  //    branch (already proven against cloud Convex).
  try {
    const created = await createImport(
      { token: convexToken },
      {
        provider: "MYSCOREIQ",
        sourceUrl: process.env.MYSCOREIQ_JSON_REPORT_URL,
      },
    );
    const importId = created!._id;
    await captureRaw(
      { token: convexToken },
      { importId, bodyText: trimmed, onlyIfOwnedByMe: true },
    );
    const result = await runNormalization(
      { token: convexToken },
      { importId },
    );
    await writeAuditLog({
      action: "BOOKMARKLET_IMPORT_SUCCESS",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: {
        tradelineCount: result.report.tradelines.length,
        candidatesCreated: result.candidatesCreated,
        bureausDetected: result.report.bureausDetected,
      },
    }).catch(() => null);
    return NextResponse.json({
      ok: true,
      importId: importId as unknown as string,
      tradelineCount: result.report.tradelines.length,
      candidatesCreated: result.candidatesCreated,
      redirect: `/dashboard/get-report?imported=${importId as unknown as string}`,
    });
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "PIPELINE_ERROR";
    await writeAuditLog({
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "User",
      entityId: userId,
      metadataJson: { stage: "pipeline", code, error: (err as Error).message },
    }).catch(() => null);
    return NextResponse.json(
      {
        ok: false,
        code,
        message: (err as Error).message,
      },
      { status: 400 },
    );
  }
}

function mapVerifyCode(c: VerifyErrorCode): string {
  switch (c) {
    case "MISSING_TOKEN":
      return "MISSING_TOKEN";
    case "EXPIRED_TOKEN":
      return "EXPIRED_TOKEN";
    case "INVALID_SIGNATURE":
    case "MALFORMED_TOKEN":
    case "BAD_PAYLOAD":
      return "INVALID_TOKEN";
    case "NO_SECRET":
      return "SERVER_NOT_CONFIGURED";
    default:
      return "INVALID_TOKEN";
  }
}
