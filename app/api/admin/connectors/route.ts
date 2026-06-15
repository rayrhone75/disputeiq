import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  connectorsEnabled,
  providerEnabled,
  CONNECTOR_PROVIDER_LIST,
} from "@/lib/credit-import/connectors/config";
import {
  workerConfigured,
  workerHealth,
} from "@/lib/credit-import/connectors/worker-client";
import { vaultConfigured } from "@/lib/credit-import/connectors/vault";
import { reportEncryptionConfigured } from "@/lib/credit-import/connectors/report-crypto";

// Admin diagnostics for the connector subsystem: flags, worker reachability,
// per-provider health (GREEN/YELLOW/RED via the worker probe), and recent
// session outcomes (no PII / drafts). Admin-gated via the Convex query.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });

  let sessions: unknown = null;
  try {
    sessions = await fetchQuery(
      api.creditConnectors.adminRecentSessions,
      { limit: 50 },
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

  // Live worker probe (best-effort — never fails the dashboard).
  let health: Record<string, { status: string; reachable: boolean }> = {};
  if (workerConfigured()) {
    try {
      const res = await workerHealth();
      for (const p of res.providers) {
        health[p.provider] = { status: p.status, reachable: true };
      }
    } catch {
      for (const p of CONNECTOR_PROVIDER_LIST) {
        health[p.id] = { status: "RED", reachable: false };
      }
    }
  } else {
    for (const p of CONNECTOR_PROVIDER_LIST) {
      health[p.id] = { status: "RED", reachable: false };
    }
  }

  return NextResponse.json({
    ok: true,
    featureEnabled: connectorsEnabled(),
    workerConfigured: workerConfigured(),
    vaultConfigured: vaultConfigured(),
    reportEncryptionConfigured: reportEncryptionConfigured(),
    providers: CONNECTOR_PROVIDER_LIST.map((p) => ({
      id: p.id,
      label: p.label,
      slug: p.slug,
      enabled: providerEnabled(p.id),
      health: health[p.id] ?? { status: "RED", reachable: false },
    })),
    sessions,
  });
}
