import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import { fetchProviderJson, ProviderFetchError } from "@/lib/credit-import/fetcher";
import { writeAuditLog } from "@/lib/audit";

// One-click MyScoreIQ Connect Report endpoint.
//
// Customer flow: signed-in user clicks "Connect MyScoreIQ Report" → this
// endpoint runs.
//
// REALITY CHECK
// MyScoreIQ exposes the JSON report at member.myscoreiq.com/CreditReport.aspx
// behind an authenticated browser session — there is no public API key,
// OAuth, or service-to-service auth. The session cookie lives in the user's
// browser, NOT on DisputeIQ's server. So a server-side fetch from this route
// will land on a login page (or 401/302) for almost every real user.
//
// We attempt the fetch anyway because (a) the door stays open for any
// future MyScoreIQ-side mechanism, and (b) the failure shape lets us
// distinguish "no session" (REQUIRES_USER_ACTION) from a true failure.
// When it fails with login-page detection, the API returns
// `requires_user_action: true` and the UI transitions to the
// browser-assisted flow ("open MyScoreIQ in a new tab → return → retry").
//
// Inputs: none — uses MYSCOREIQ_JSON_REPORT_URL from env.
// Returns: { status, importId?, reportId?, requires_user_action?, ... }

const DEFAULT_JSON_URL =
  "https://member.myscoreiq.com/CreditReport.aspx?view=json";

type ConnectResponse =
  | {
      status: "connected";
      importId: string;
      tradelineCount: number;
      candidatesCreated: number;
    }
  | {
      status: "requires_user_action";
      importId: string;
      message: string;
      affiliateUrl: string;
      jsonUrl: string;
      reason:
        | "NO_SESSION"
        | "LOGIN_PAGE_DETECTED"
        | "HTTP_UNAUTHORIZED"
        | "BLOCKED_BY_PROVIDER";
    }
  | {
      status: "failed";
      importId?: string;
      message: string;
      code: string;
    };

export async function POST(_req: NextRequest): Promise<NextResponse<ConnectResponse>> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { status: "failed", message: "Sign in required.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  const token = await getToken({ template: "convex" });

  const jsonUrl = process.env.MYSCOREIQ_JSON_REPORT_URL ?? DEFAULT_JSON_URL;
  const affiliateUrl =
    process.env.MYSCOREIQ_AFFILIATE_URL ??
    "https://gcpstage.myscoreiq.com/get-fico-preferred.aspx?offercode=432500C3";

  // 1. Create the import row up front so we have something to attach
  //    success/failure to in the dashboard, even before the fetch attempt.
  let importId: Id<"creditReportImports">;
  try {
    const created = await createImport(
      { token },
      {
        provider: "MYSCOREIQ",
        sourceUrl: jsonUrl,
        importMethod: "auto-json",
      },
    );
    importId = created!._id;
  } catch (err) {
    return NextResponse.json(
      {
        status: "failed",
        message: (err as Error).message,
        code: "CREATE_FAILED",
      },
      { status: 500 },
    );
  }

  await writeAuditLog({
    targetUserId: userId,
    actorUserId: userId,
    action: "MSIQ_CONNECT_ATTEMPT",
    entityType: "CreditReportImport",
    entityId: importId as unknown as string,
    metadataJson: { jsonUrl },
  }).catch(() => null);

  // 2. Attempt the server-side fetch. Without a Cookie header MyScoreIQ
  //    will redirect to its login page; the fetcher follows redirects so
  //    we end up reading HTML, not JSON. We detect that and translate the
  //    result to REQUIRES_USER_ACTION instead of a generic parse error.
  let bodyText: string;
  let contentType: string | null;
  try {
    const fetched = await fetchProviderJson({ url: jsonUrl });
    bodyText = fetched.bodyText;
    contentType = fetched.contentType;
  } catch (err) {
    // Network/timeout/HTTP error. Special-case 401/403 → requires_user_action.
    if (err instanceof ProviderFetchError) {
      const status = err.status ?? 0;
      if (status === 401 || status === 403) {
        return await markRequiresUserAction(
          token,
          importId,
          jsonUrl,
          affiliateUrl,
          "HTTP_UNAUTHORIZED",
          "MyScoreIQ rejected the request without a logged-in browser session.",
        );
      }
      await fetchMutation(
        api.creditImports.markFailed,
        {
          importId,
          code: err.code,
          message: err.message,
          detailJson: { httpStatus: err.status ?? null },
        },
        { token: token ?? undefined },
      ).catch(() => null);
      return NextResponse.json(
        {
          status: "failed",
          importId: importId as unknown as string,
          message: err.message,
          code: err.code,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        status: "failed",
        importId: importId as unknown as string,
        message: (err as Error).message,
        code: "FETCH_FAILED",
      },
      { status: 502 },
    );
  }

  // 3. Login-page detection. MyScoreIQ's anonymous flow returns the login
  //    HTML with HTTP 200, content-type text/html (or no JSON). We look at
  //    both the content-type and a tiny prefix of the body.
  if (looksLikeLoginPage(bodyText, contentType)) {
    return await markRequiresUserAction(
      token,
      importId,
      jsonUrl,
      affiliateUrl,
      "LOGIN_PAGE_DETECTED",
      "MyScoreIQ returned its login page — your browser session didn't reach our server.",
    );
  }

  // 4. We have something JSON-shaped. Parse + capture + normalize.
  try {
    JSON.parse(bodyText);
  } catch {
    // Body wasn't HTML but also isn't JSON. Treat as a soft "needs login"
    // because MyScoreIQ-side filters often return small text snippets.
    return await markRequiresUserAction(
      token,
      importId,
      jsonUrl,
      affiliateUrl,
      "BLOCKED_BY_PROVIDER",
      "MyScoreIQ responded with non-JSON content. Likely an interstitial or block page.",
    );
  }

  try {
    await captureRaw(
      { token },
      { importId, bodyText, onlyIfOwnedByMe: true },
    );
    const result = await runNormalization({ token }, { importId });

    await writeAuditLog({
      targetUserId: userId,
      actorUserId: userId,
      action: "MSIQ_CONNECT_SUCCESS",
      entityType: "CreditReportImport",
      entityId: importId as unknown as string,
      metadataJson: {
        tradelines: result.report.tradelines.length,
        candidates: result.candidatesCreated,
      },
    }).catch(() => null);

    return NextResponse.json({
      status: "connected",
      importId: importId as unknown as string,
      tradelineCount: result.report.tradelines.length,
      candidatesCreated: result.candidatesCreated,
    });
  } catch (err) {
    if (err instanceof ImportRunnerError) {
      return NextResponse.json(
        {
          status: "failed",
          importId: importId as unknown as string,
          message: err.message,
          code: err.code,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        status: "failed",
        importId: importId as unknown as string,
        message: (err as Error).message,
        code: "INTERNAL",
      },
      { status: 500 },
    );
  }
}

async function markRequiresUserAction(
  token: string | null,
  importId: Id<"creditReportImports">,
  jsonUrl: string,
  affiliateUrl: string,
  reason:
    | "NO_SESSION"
    | "LOGIN_PAGE_DETECTED"
    | "HTTP_UNAUTHORIZED"
    | "BLOCKED_BY_PROVIDER",
  message: string,
): Promise<NextResponse<ConnectResponse>> {
  await fetchMutation(
    api.creditImports.markFailed,
    {
      importId,
      code: "REQUIRES_USER_ACTION",
      message,
      detailJson: { reason, jsonUrl },
    },
    { token: token ?? undefined },
  ).catch(() => null);

  return NextResponse.json({
    status: "requires_user_action",
    importId: importId as unknown as string,
    message,
    affiliateUrl,
    jsonUrl,
    reason,
  });
}

/**
 * Heuristic — if the response body smells like an HTML login page, MyScoreIQ
 * is asking the user to authenticate. We never want to capture that as a
 * "credit report" so we always intercept here before the parse step.
 */
function looksLikeLoginPage(body: string, contentType: string | null): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  const head = body.slice(0, 4096).toLowerCase();
  if (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("login.aspx") ||
    head.includes("login.master") ||
    head.includes("sign in to myscoreiq") ||
    head.includes("please log in") ||
    head.includes("session has expired")
  ) {
    return true;
  }
  return false;
}
