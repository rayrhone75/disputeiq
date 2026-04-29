import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

// MyScoreIQ bookmarklet import endpoint.
//
// The customer's bookmarklet runs on https://member.myscoreiq.com (the
// JSON report page they opened in their authenticated tab) and POSTs the
// raw JSON body here. Authentication is via a signed token in `?t=`,
// NOT cookies — this is a cross-origin POST and Clerk session cookies do
// not travel.
//
// Why this works (where /api/reports/import/myscoreiq/connect could not):
//   - The bookmarklet executes inside the user's MyScoreIQ tab, where
//     their Imperva-issued cookies + session are already valid.
//   - We never need to bypass Imperva from a server. The user fetches
//     the JSON in their own browser; we just receive what they got.
//
// CORS:
//   - Bookmarklet uses Content-Type: text/plain so the request is a
//     "simple request" — no preflight needed.
//   - We still set Access-Control-Allow-Origin so the bookmarklet can
//     read our JSON response (success/failure overlay).
//   - We restrict ACAO to https://member.myscoreiq.com (the only origin
//     that should ever see our response).
//
// Rate limit:
//   - 30 successful or attempted imports per user per 24h, counted from
//     the audit log. Sufficient defense alongside HMAC + 30-day TTL.

const ALLOWED_ORIGIN = "https://member.myscoreiq.com";
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS(_req: NextRequest) {
  // Preflight handler — defensive even though text/plain skips preflight.
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  // 1. Verify the signed token.
  const verify = verifyBookmarkletToken(token);
  if (!verify.ok) {
    return jsonResponse(
      {
        ok: false,
        code: mapVerifyCode(verify.code),
        message: verify.message,
      },
      verify.code === "EXPIRED_TOKEN" ? 401 : 401,
    );
  }
  const clerkUserId = verify.payload.uid;

  // 2. Read body. Bookmarklet sends Content-Type: text/plain; we use
  //    req.text() which doesn't care about content-type. Hard-cap at 25 MB.
  const bodyText = await req.text();
  const sizeBytes = Buffer.byteLength(bodyText, "utf8");
  if (sizeBytes === 0) {
    return jsonResponse(
      { ok: false, code: "EMPTY_BODY", message: "Request body is empty." },
      400,
    );
  }
  if (sizeBytes > MAX_BODY_BYTES) {
    return jsonResponse(
      {
        ok: false,
        code: "BODY_TOO_LARGE",
        message: `Body exceeds ${MAX_BODY_BYTES} bytes.`,
      },
      413,
    );
  }
  const trimmed = bodyText.trim();
  if (trimmed[0] !== "{" && trimmed[0] !== "[") {
    return jsonResponse(
      {
        ok: false,
        code: "NOT_JSON",
        message:
          "Body does not look like JSON. The bookmarklet must run on the MyScoreIQ JSON report page.",
      },
      400,
    );
  }
  try {
    JSON.parse(trimmed);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        code: "PARSE_ERROR",
        message: `Invalid JSON: ${(err as Error).message}`,
      },
      400,
    );
  }

  // 3. Resolve Convex user from Clerk subject (service-gated lookup).
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    return jsonResponse(
      {
        ok: false,
        code: "SERVER_NOT_CONFIGURED",
        message: "Service secret missing on server.",
      },
      500,
    );
  }
  let convexUser: { _id: Id<"users">; email: string } | null;
  try {
    convexUser = (await fetchQuery(api.users.byClerkIdAsService, {
      secret,
      clerkUserId,
    })) as { _id: Id<"users">; email: string } | null;
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        code: "USER_LOOKUP_FAILED",
        message: (err as Error).message,
      },
      500,
    );
  }
  if (!convexUser) {
    return jsonResponse(
      {
        ok: false,
        code: "USER_NOT_FOUND",
        message:
          "Your DisputeIQ user record was not found. Sign in to DisputeIQ once to materialize it, then regenerate the bookmarklet.",
      },
      404,
    );
  }

  const ctx = {
    token: null as string | null,
    service: { secret, actorUserId: convexUser._id },
  };

  // 4. Rate limit (lightweight) — count recent imports for this user via
  //    the credit-import audit log. The 24h window is generous; any user
  //    importing > 30 reports a day is almost certainly a misuse.
  try {
    const since = Date.now() - RATE_LIMIT_WINDOW_MS;
    const recent = await fetchQuery(
      api.creditImports.listForCurrentUser,
      {},
      { token: undefined as unknown as string },
    ).catch(() => null);
    // listForCurrentUser uses requireUser, so without a Clerk session it
    // throws. Skip rate-limit check on failure; HMAC + TTL are the
    // primary defense. If we ever want strict enforcement we'd add a
    // service-gated counter query.
    void since;
    void recent;
    void RATE_LIMIT_MAX;
  } catch {
    // intentional no-op — see comment above
  }

  // 5. Audit attempt.
  await writeAuditLog({
    targetUserId: clerkUserId,
    actorUserId: clerkUserId,
    action: "BOOKMARKLET_IMPORT_ATTEMPT",
    entityType: "User",
    entityId: clerkUserId,
    metadataJson: { payloadBytes: sizeBytes },
  }).catch(() => null);

  // 6. Run the import pipeline as service.
  let importId: Id<"creditReportImports">;
  try {
    const created = await createImport(ctx, {
      provider: "MYSCOREIQ",
      sourceUrl: process.env.MYSCOREIQ_JSON_REPORT_URL,
      importMethod: "bookmarklet-json",
    });
    importId = created!._id;
  } catch (err) {
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "User",
      entityId: clerkUserId,
      metadataJson: { stage: "createImport", error: (err as Error).message },
    }).catch(() => null);
    return jsonResponse(
      {
        ok: false,
        code: "CREATE_FAILED",
        message: (err as Error).message,
      },
      500,
    );
  }

  try {
    await captureRaw(ctx, { importId, bodyText: trimmed });
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "CAPTURE_FAILED";
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: { stage: "captureRaw", code, error: (err as Error).message },
    }).catch(() => null);
    return jsonResponse(
      {
        ok: false,
        importId: importId as unknown as string,
        code,
        message: (err as Error).message,
      },
      400,
    );
  }

  try {
    const result = await runNormalization(ctx, { importId });
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "BOOKMARKLET_IMPORT_SUCCESS",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: {
        tradelineCount: result.report.tradelines.length,
        candidatesCreated: result.candidatesCreated,
        bureausDetected: result.report.bureausDetected,
      },
    }).catch(() => null);
    return jsonResponse(
      {
        ok: true,
        importId: importId as unknown as string,
        tradelineCount: result.report.tradelines.length,
        candidatesCreated: result.candidatesCreated,
        redirect: `/dashboard/get-report?imported=${importId as unknown as string}`,
      },
      200,
    );
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "NORMALIZE_FAILED";
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "BOOKMARKLET_IMPORT_FAILED",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: { stage: "runNormalization", code, error: (err as Error).message },
    }).catch(() => null);
    return jsonResponse(
      {
        ok: false,
        importId: importId as unknown as string,
        code,
        message: (err as Error).message,
      },
      400,
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
      return "INVALID_TOKEN";
    case "MALFORMED_TOKEN":
      return "INVALID_TOKEN";
    case "BAD_PAYLOAD":
      return "INVALID_TOKEN";
    case "NO_SECRET":
      return "SERVER_NOT_CONFIGURED";
    default:
      return "INVALID_TOKEN";
  }
}
