import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { encryptReport } from "@/lib/credit-import/connectors/report-crypto";
import {
  connectorsEnabled,
  providerEnabled,
  getConnectorProvider,
  isConnectorProvider,
} from "@/lib/credit-import/connectors/config";
import { runConnector } from "@/lib/credit-import/connectors/run";
import { processConnectorReport } from "@/lib/credit-import/connectors/import";
import {
  encryptCredentials,
  credentialHints,
  vaultConfigured,
  decryptCredentials,
} from "@/lib/credit-import/connectors/vault";
import type { ConnectorCredentials } from "@/lib/credit-import/connectors/types";

// Connector PREVIEW: log into the provider, retrieve + parse the report,
// stash an encrypted draft, and return a preview WITHOUT saving. The
// customer reviews the preview, then POSTs /save to commit it.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  provider: z.string().min(1),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to import your report." }),
  }),
  rememberLogin: z.boolean().optional().default(false),
  useSavedLogin: z.boolean().optional().default(false),
  mfaCode: z.string().trim().max(12).optional(),
  credentials: z
    .object({
      username: z.string().trim().min(1).max(200).optional(),
      password: z.string().min(1).max(400).optional(),
      last4SSN: z.string().trim().regex(/^\d{4}$/).optional(),
    })
    .optional(),
});

function statusForError(code: string): "NEEDS_MFA" | "NEEDS_CAPTCHA" | "FAILED" {
  if (code === "MFA_REQUIRED") return "NEEDS_MFA";
  if (code === "CAPTCHA") return "NEEDS_CAPTCHA";
  return "FAILED";
}

export async function POST(req: NextRequest) {
  if (!connectorsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "FEATURE_DISABLED", message: "Auto-import isn't available yet." },
      { status: 404 },
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const token = (await getToken({ template: "convex" })) ?? null;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const def = getConnectorProvider(body.provider);
  if (!def || !isConnectorProvider(body.provider)) {
    return NextResponse.json(
      { ok: false, error: "UNKNOWN_PROVIDER", message: "Unsupported provider." },
      { status: 400 },
    );
  }
  if (!providerEnabled(body.provider)) {
    return NextResponse.json(
      {
        ok: false,
        error: "PROVIDER_DISABLED",
        message: `${def.label} auto-import isn't turned on yet.`,
      },
      { status: 404 },
    );
  }

  // Mirror the Clerk user into Convex so user-scoped mutations don't
  // throw USER_NOT_MIRRORED on a first-time customer (same as upload-any).
  if (token) {
    try {
      const u = await currentUser();
      const email =
        u?.primaryEmailAddress?.emailAddress ??
        u?.emailAddresses?.[0]?.emailAddress ??
        "";
      if (email) await fetchMutation(api.users.upsertFromClerk, { email }, { token });
    } catch {
      /* non-fatal — the mutations below surface a clean error if needed */
    }
  }

  // Resolve credentials: either from the saved vault or the request body.
  let credentials: ConnectorCredentials;
  if (body.useSavedLogin) {
    const vault = await fetchQuery(
      api.creditConnectors.getVault,
      { provider: body.provider },
      { token: token ?? undefined },
    );
    if (!vault) {
      return NextResponse.json(
        { ok: false, error: "NO_SAVED_LOGIN", message: "No saved login for this provider." },
        { status: 400 },
      );
    }
    try {
      credentials = decryptCredentials(vault.encryptedCredentials);
    } catch {
      return NextResponse.json(
        { ok: false, error: "VAULT_ERROR", message: "Saved login couldn't be read. Please re-enter it." },
        { status: 400 },
      );
    }
  } else {
    const c = body.credentials;
    if (!c?.username || !c?.password) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CREDENTIALS", message: "Username and password are required." },
        { status: 400 },
      );
    }
    if (def.fields.includes("last4SSN") && !c.last4SSN) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SSN", message: `${def.label} requires the last 4 of your SSN.` },
        { status: 400 },
      );
    }
    credentials = { username: c.username, password: c.password, last4SSN: c.last4SSN };
  }

  // Open a session row up-front so even a crash leaves an audit trail.
  const sessionId = (await fetchMutation(
    api.creditConnectors.createSession,
    { provider: body.provider, rememberLogin: body.rememberLogin },
    { token: token ?? undefined },
  )) as Id<"creditConnectorSessions">;

  // 1. Drive the browser login + report fetch.
  const outcome = await runConnector({
    provider: body.provider,
    credentials,
    mfaCode: body.mfaCode,
  });

  if (!outcome.ok) {
    await fetchMutation(
      api.creditConnectors.updateSession,
      {
        sessionId,
        status: statusForError(outcome.code),
        errorCode: outcome.code,
        errorMessage: outcome.userMessage,
        retryable: outcome.retryable,
        logJson: outcome.log,
      },
      { token: token ?? undefined },
    );
    return NextResponse.json(
      {
        ok: false,
        sessionId,
        error: outcome.code,
        message: outcome.userMessage,
        retryable: outcome.retryable,
      },
      { status: 200 },
    );
  }

  // 2. Parse the fetched report into a preview + save draft.
  let processed;
  try {
    processed = await processConnectorReport(body.provider, outcome.result.fetched);
  } catch (err) {
    await fetchMutation(
      api.creditConnectors.updateSession,
      {
        sessionId,
        status: "FAILED",
        errorCode: "PARSE_FAILED",
        errorMessage: "We pulled your report but couldn't read the data automatically.",
        retryable: false,
        logJson: outcome.result.log,
      },
      { token: token ?? undefined },
    );
    return NextResponse.json(
      {
        ok: false,
        sessionId,
        error: "PARSE_FAILED",
        message: `We pulled your report but couldn't read the data automatically (${(err as Error).message.slice(0, 120)}).`,
        retryable: false,
      },
      { status: 200 },
    );
  }

  // 3. Stash the encrypted draft + preview on the session (dedicated
  //    report-encryption key). Only saved after the customer confirms.
  const encryptedDraft = encryptReport(JSON.stringify(processed.draft));
  await fetchMutation(
    api.creditConnectors.updateSession,
    {
      sessionId,
      status: "PREVIEW_READY",
      logJson: outcome.result.log,
      previewJson: processed.preview,
      encryptedDraft,
      draftBytes: encryptedDraft.length,
    },
    { token: token ?? undefined },
  );

  // 4. Optionally remember the login (encrypted with the vault key).
  let savedLogin = false;
  if (body.rememberLogin && !body.useSavedLogin && vaultConfigured()) {
    try {
      const hints = credentialHints(credentials);
      await fetchMutation(
        api.creditConnectors.upsertVault,
        {
          provider: body.provider,
          encryptedCredentials: encryptCredentials(credentials),
          usernameHint: hints.usernameHint,
          ssnLast4Hint: hints.ssnLast4Hint,
        },
        { token: token ?? undefined },
      );
      savedLogin = true;
    } catch {
      /* never fail the import because remember-login couldn't be saved */
    }
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    preview: processed.preview,
    savedLogin,
  });
}
