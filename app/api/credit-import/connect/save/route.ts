import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { decryptReport } from "@/lib/credit-import/connectors/report-crypto";
import {
  createImport,
  captureRaw,
  runNormalization,
  ImportRunnerError,
} from "@/lib/credit-import/runner";
import { connectorsEnabled } from "@/lib/credit-import/connectors/config";
import type { ConnectorDraft } from "@/lib/credit-import/connectors/import";

// Connector SAVE: commit a PREVIEW_READY session's draft into a real
// import via the same createImport → captureRaw → runNormalization
// pipeline manual uploads use. Provider is recorded as MYSCOREIQ (the
// shape processCreditReport emits); the true source provider is kept in
// providerRef + the connector session.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({ sessionId: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!connectorsEnabled()) {
    return NextResponse.json(
      { ok: false, error: "FEATURE_DISABLED" },
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
  const sessionId = parsed.data.sessionId as Id<"creditConnectorSessions">;

  const session = await fetchQuery(
    api.creditConnectors.getSession,
    { sessionId },
    { token: token ?? undefined },
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
  }
  if (session.status !== "PREVIEW_READY" || !session.encryptedDraft) {
    return NextResponse.json(
      { ok: false, error: "NO_DRAFT", message: "This import isn't ready to save. Re-run the import." },
      { status: 409 },
    );
  }

  let draft: ConnectorDraft;
  try {
    draft = JSON.parse(decryptReport(session.encryptedDraft)) as ConnectorDraft;
  } catch {
    return NextResponse.json(
      { ok: false, error: "DRAFT_UNREADABLE", message: "Couldn't read the saved report. Please re-run the import." },
      { status: 400 },
    );
  }

  let importId: Id<"creditReportImports"> | null = null;
  try {
    const created = await createImport(
      { token },
      {
        provider: "MYSCOREIQ",
        providerRef: session.provider,
        importMethod: "connector",
      },
    );
    importId = (created as { _id: Id<"creditReportImports"> } | null)?._id ?? null;
    if (!importId) {
      return NextResponse.json(
        { ok: false, error: "CREATE_FAILED", message: "Could not create the import. Try again." },
        { status: 500 },
      );
    }
    await captureRaw(
      { token },
      { importId, bodyText: JSON.stringify(draft.myscoreiqJson), onlyIfOwnedByMe: true },
    );

    // Best-effort per-bureau-column UI data.
    try {
      const p = draft.paralegal;
      await fetchMutation(
        api.creditImports.recordParalegalOutput,
        {
          importId,
          consumer: p.consumer ?? undefined,
          accounts: p.accounts ?? [],
          collections: p.collections ?? [],
          inquiries: p.inquiries ?? [],
          publicRecords: p.public_records ?? [],
          consumerStatements: p.consumer_statements ?? undefined,
          extractedTextLength: 0,
        },
        { token: token ?? undefined },
      );
    } catch {
      /* non-fatal */
    }
  } catch (err) {
    const code = err instanceof ImportRunnerError ? err.code : "CAPTURE_ERROR";
    return NextResponse.json(
      { ok: false, error: code, message: (err as Error).message },
      { status: 500 },
    );
  }

  let parsedCount = 0;
  try {
    const normalized = await runNormalization({ token }, { importId });
    parsedCount = normalized.report.tradelines.length;
  } catch {
    // Persisted but normalization blipped — still mark saved; the results
    // page handles the "analyzing" state.
  }

  await fetchMutation(
    api.creditConnectors.finalizeSaved,
    { sessionId, importId },
    { token: token ?? undefined },
  );

  return NextResponse.json({
    ok: true,
    importId,
    parsedCount,
    redirectTo: "/dashboard/get-report?imported=1",
  });
}
