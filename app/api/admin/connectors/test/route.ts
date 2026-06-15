import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { isConnectorProvider } from "@/lib/credit-import/connectors/config";
import {
  workerTest,
  workerConfigured,
  WorkerUnavailable,
} from "@/lib/credit-import/connectors/worker-client";

// Admin live connector test. Drives a real Playwright session on the
// worker with the supplied TEST credentials and returns detection
// booleans + step screenshots + GREEN/YELLOW/RED status. Admin-only.
//
// These are operator-entered test credentials; they are forwarded to the
// worker for this one run and never stored.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 200;

const bodySchema = z.object({
  provider: z.string().min(1),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(400),
  last4SSN: z.string().regex(/^\d{4}$/).optional(),
  mfaCode: z.string().max(12).optional(),
});

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });

  // Authorize as admin (throws FORBIDDEN for non-admins).
  try {
    await fetchQuery(
      api.creditConnectors.adminRecentSessions,
      { limit: 1 },
      { token: token ?? undefined },
    );
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isConnectorProvider(parsed.data.provider)) {
    return NextResponse.json({ error: "UNKNOWN_PROVIDER" }, { status: 400 });
  }
  if (!workerConfigured()) {
    return NextResponse.json(
      {
        error: "WORKER_UNAVAILABLE",
        message:
          "Connector worker not configured. Set CONNECTOR_WORKER_URL + CONNECTOR_WORKER_SECRET.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await workerTest({
      provider: parsed.data.provider,
      credentials: {
        username: parsed.data.username,
        password: parsed.data.password,
        last4SSN: parsed.data.last4SSN,
      },
      mfaCode: parsed.data.mfaCode,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const unavailable = err instanceof WorkerUnavailable;
    return NextResponse.json(
      {
        error: unavailable ? "WORKER_UNAVAILABLE" : "WORKER_ERROR",
        message: (err as Error).message,
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
