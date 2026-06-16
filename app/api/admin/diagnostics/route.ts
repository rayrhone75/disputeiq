// Admin launch diagnostics — env-var presence + live subsystem health.
// Presence only; never returns secret values. OWNER/ADMIN gated.

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildEnvReport } from "@/lib/diagnostics/env-checks";
import { selectPaymentProvider, stripeConfigured } from "@/lib/payments/provider";
import { squareConfigured } from "@/lib/square";
import {
  workerConfigured,
  workerHealth,
} from "@/lib/credit-import/connectors/worker-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const env = buildEnvReport();

  // Connector worker reachability (best-effort).
  let worker: { configured: boolean; reachable: boolean; providers: unknown[] } = {
    configured: workerConfigured(),
    reachable: false,
    providers: [],
  };
  if (workerConfigured()) {
    try {
      const res = await workerHealth();
      worker = { configured: true, reachable: true, providers: res.providers };
    } catch {
      worker.reachable = false;
    }
  }

  return NextResponse.json({
    ok: true,
    launchReady: env.launchReady,
    env,
    payments: {
      selectedOneTimeProvider: selectPaymentProvider(),
      squareConfigured: squareConfigured(),
      stripeConfigured: stripeConfigured(),
    },
    worker,
  });
}
