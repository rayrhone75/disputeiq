import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  verifyExtensionToken,
  hashToken,
} from "@/lib/auth/extension-token";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import {
  processCreditReport,
  MistralOcrError,
  ParalegalExtractionError,
} from "@/lib/credit-import/process-report";
import { writeAuditLog } from "@/lib/audit";

// Chrome-extension JSON import endpoint.
//
// The extension authenticates with a Bearer extension-token in the
// Authorization header. Token must:
//   - Verify against INTERNAL_SERVICE_SECRET via HMAC.
//   - Carry purpose="extension-token".
//   - Resolve to an active (non-revoked, non-expired) extensionPairings
//     row in Convex.
//
// On valid auth, the raw JSON body is fed through the existing
// createImport → captureRaw → runNormalization pipeline as a service
// caller (no Clerk session required, identity established by token).
//
// CORS: chrome-extension:// origin. We allow * because tokens already
// gate access; locking down by extension id requires production
// publication first.

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Extension-Version",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS(_req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  // 1. Bearer auth.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const verify = verifyExtensionToken(token, "extension-token");
  if (!verify.ok) {
    return jsonResponse(
      { ok: false, code: verify.code, message: verify.message },
      401,
    );
  }
  const clerkUserId = verify.payload.uid;
  const extensionVersion =
    req.headers.get("x-extension-version") ?? undefined;

  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  if (!secret) {
    return jsonResponse({ ok: false, code: "SERVER_NOT_CONFIGURED" }, 500);
  }

  // 2. Resolve pairing — confirms not revoked/expired.
  const pairing = await fetchQuery(
    api.extensionPairings.lookupActiveByTokenHash,
    { secret, tokenHash: hashToken(token!) },
  ).catch(() => null);
  if (!pairing) {
    return jsonResponse(
      {
        ok: false,
        code: "PAIRING_REVOKED_OR_MISSING",
        message:
          "This extension is no longer paired. Re-pair from disputeiq.org/dashboard/get-report.",
      },
      401,
    );
  }

  // 3. Read body (raw JSON, possibly text/plain or application/json).
  const bodyText = await req.text();
  const sizeBytes = Buffer.byteLength(bodyText, "utf8");
  if (sizeBytes === 0) {
    return jsonResponse({ ok: false, code: "EMPTY_BODY" }, 400);
  }
  if (sizeBytes > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, code: "BODY_TOO_LARGE" }, 413);
  }
  const trimmed = bodyText.trim();
  if (trimmed[0] !== "{" && trimmed[0] !== "[") {
    return jsonResponse(
      {
        ok: false,
        code: "NOT_JSON",
        message:
          "Body is not JSON. Extension must read MyScoreIQ JSON page body.",
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

  // Same canonical processing pipeline as the manual upload path.
  // Even though the extension delivers clean MyScoreIQ JSON, running it
  // through the paralegal gives us one normalized output shape across
  // all entry points and catches malformed payloads early.
  if (!process.env.MISTRAL_API_KEY) {
    return jsonResponse(
      {
        ok: false,
        code: "MISTRAL_API_KEY_MISSING",
        message:
          "Server configuration error (MISTRAL_API_KEY missing). Please contact support.",
      },
      503,
    );
  }
  let processed;
  try {
    processed = await processCreditReport(
      { format: "json", text: trimmed },
      {
        logStage: (event, data) => {
          // eslint-disable-next-line no-console
          console.log(`[ext-import] process:${event}`, data ?? {});
        },
      },
    );
  } catch (err) {
    const code =
      err instanceof MistralOcrError
        ? "OCR_FAILED"
        : err instanceof ParalegalExtractionError
        ? "PARALEGAL_FAILED"
        : "PROCESS_FAILED";
    return jsonResponse(
      { ok: false, code, message: (err as Error).message },
      502,
    );
  }
  if (processed.result.counts.tradelines === 0) {
    return jsonResponse(
      {
        ok: false,
        code: "EMPTY_REPORT",
        message: "The extension JSON did not contain a recognizable report.",
        reasonCodes: processed.result.reasonCodes,
      },
      422,
    );
  }
  const normalizedJson = JSON.stringify(processed.result.json);

  await writeAuditLog({
    targetUserId: clerkUserId,
    actorUserId: clerkUserId,
    action: "EXTENSION_IMPORT_ATTEMPT",
    entityType: "ExtensionPairing",
    entityId: pairing._id as unknown as string,
    metadataJson: {
      payloadBytes: sizeBytes,
      extensionVersion: extensionVersion ?? null,
    },
  }).catch(() => null);

  // 4. Resolve Convex user id — record on the audit + use as service actor.
  const convexUserId = pairing.userId;
  const ctx = {
    token: null as string | null,
    service: { secret, actorUserId: convexUserId as Id<"users"> },
  };

  // 5. Run the import pipeline.
  let importId: Id<"creditReportImports">;
  try {
    const created = await createImport(ctx, {
      provider: "MYSCOREIQ",
      sourceUrl: process.env.MYSCOREIQ_JSON_REPORT_URL,
      importMethod: "chrome-extension",
    });
    importId = created!._id;
  } catch (err) {
    await fetchMutation(api.extensionPairings.recordFailure, {
      secret,
      pairingId: pairing._id,
      error: `createImport: ${(err as Error).message}`,
    }).catch(() => null);
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "EXTENSION_IMPORT_FAILED",
      entityType: "ExtensionPairing",
      entityId: pairing._id as unknown as string,
      metadataJson: { stage: "createImport", error: (err as Error).message },
    }).catch(() => null);
    return jsonResponse(
      { ok: false, code: "CREATE_FAILED", message: (err as Error).message },
      500,
    );
  }

  try {
    await captureRaw(ctx, { importId, bodyText: normalizedJson });
  } catch (err) {
    const code = err instanceof ImportRunnerError ? err.code : "CAPTURE_FAILED";
    await fetchMutation(api.extensionPairings.recordFailure, {
      secret,
      pairingId: pairing._id,
      error: `captureRaw: ${(err as Error).message}`,
    }).catch(() => null);
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "EXTENSION_IMPORT_FAILED",
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
    await fetchMutation(api.extensionPairings.recordImport, {
      secret,
      pairingId: pairing._id,
      importId,
    }).catch(() => null);
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "EXTENSION_IMPORT_SUCCESS",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: {
        tradelineCount: result.report.tradelines.length,
        candidatesCreated: result.candidatesCreated,
        bureausDetected: result.report.bureausDetected,
        extensionVersion: extensionVersion ?? null,
      },
    }).catch(() => null);
    return jsonResponse(
      {
        ok: true,
        importId: importId as unknown as string,
        status: "NORMALIZED",
        tradelineCount: result.report.tradelines.length,
        candidatesCreated: result.candidatesCreated,
        counts: {
          tradelines: result.report.tradelines.length,
          inquiries: result.report.inquiries.length,
          collections: result.report.collections.length,
          publicRecords: result.report.publicRecords.length,
          candidates: result.candidatesCreated,
        },
        redirect: `/dashboard/get-report?imported=${importId as unknown as string}`,
      },
      200,
    );
  } catch (err) {
    const code =
      err instanceof ImportRunnerError ? err.code : "NORMALIZE_FAILED";
    await fetchMutation(api.extensionPairings.recordFailure, {
      secret,
      pairingId: pairing._id,
      error: `runNormalization: ${(err as Error).message}`,
    }).catch(() => null);
    await writeAuditLog({
      targetUserId: clerkUserId,
      actorUserId: clerkUserId,
      action: "EXTENSION_IMPORT_FAILED",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: {
        stage: "runNormalization",
        code,
        error: (err as Error).message,
      },
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
