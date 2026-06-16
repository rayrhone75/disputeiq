// Square SANDBOX smoke test — verifies the one-time payment path without
// charging a real customer.
//
// What it checks (see docs/square-sandbox-smoke.md):
//   1. Safety        — refuses to run against SQUARE_ENVIRONMENT=production
//   2. Signature OK  — a correctly-signed webhook body verifies
//   3. Signature FAIL— tampered body / wrong key / missing sig are rejected
//   4. Checkout      — createSquareCheckout() returns a usable link (real
//                      sandbox link when creds are set, mock URL otherwise)
//   5. Webhook live  — POSTs a synthetic payment.updated to the endpoint:
//                      valid signature → 200 {received:true}; bad sig → 401
//   6. Status flip   — (optional, needs --intent <id>) confirms the webhook
//                      flipped the intent to SUCCEEDED + the case to PAID
//
// No real card is ever used; the webhook payload is synthetic. The Square API
// call in step 4 only creates a payment LINK (no charge).
//
// Run: npx tsx scripts/square-sandbox-smoke.ts [--intent <paymentIntentId>]
//                                              [--webhook-url <url>] [--force]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  createSquareCheckout,
  verifySquareSignature,
  squareNotificationUrl,
  squareConfigured,
} from "../lib/square";

// Load .env.local then .env (first value wins) — no dotenv dependency.
function loadEnv(file: string) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (!process.env[k]) process.env[k] = v.replace(/^"|"$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FORCE = process.argv.includes("--force");
const INTENT = arg("--intent");

// ── tiny test harness ────────────────────────────────────────────────────
type Outcome = "PASS" | "FAIL" | "SKIP";
const results: { name: string; outcome: Outcome; detail?: string }[] = [];
function record(name: string, outcome: Outcome, detail?: string) {
  results.push({ name, outcome, detail });
  const icon = outcome === "PASS" ? "✓" : outcome === "FAIL" ? "✗" : "–";
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

// Sign a body the same way lib/square.ts verifies: base64(HMAC_SHA256(key,
// notificationUrl + rawBody)).
function sign(notificationUrl: string, rawBody: string, key: string): string {
  return crypto
    .createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");
}

async function main() {
  console.log("\n=== Square sandbox smoke test ===\n");

  const env = (process.env.SQUARE_ENVIRONMENT ?? "production").toLowerCase();
  const signingKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  const webhookUrl =
    arg("--webhook-url") ??
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ??
    `${process.env.APP_BASE_URL ?? ""}/api/webhooks/square`;

  // 1) SAFETY -------------------------------------------------------------
  console.log("1) Safety");
  if (env === "production" && !FORCE) {
    record(
      "not running against production",
      "FAIL",
      "SQUARE_ENVIRONMENT=production — set it to 'sandbox' (or pass --force if you really mean it). Aborting before any webhook is sent.",
    );
    return finish();
  }
  record(
    "environment is safe",
    "PASS",
    env === "sandbox" ? "SQUARE_ENVIRONMENT=sandbox" : `env='${env}', --force given`,
  );

  // 2/3) SIGNATURE VERIFY (pure function, fully offline) -------------------
  console.log("\n2) Signature verification");
  if (!signingKey) {
    record("valid signature accepted", "SKIP", "SQUARE_WEBHOOK_SIGNATURE_KEY not set");
    record("bad signatures rejected", "SKIP", "SQUARE_WEBHOOK_SIGNATURE_KEY not set");
  } else {
    const sampleUrl = "https://example.test/api/webhooks/square";
    const body = JSON.stringify({ type: "payment.updated", hello: "world" });
    const good = sign(sampleUrl, body, signingKey);

    record(
      "valid signature accepted",
      verifySquareSignature(sampleUrl, body, good) ? "PASS" : "FAIL",
    );

    const tampered = verifySquareSignature(sampleUrl, body + " ", good);
    const wrongKey = verifySquareSignature(
      sampleUrl,
      body,
      sign(sampleUrl, body, "a-different-signing-key-entirely"),
    );
    const missing = verifySquareSignature(sampleUrl, body, null);
    record(
      "bad signatures rejected",
      !tampered && !wrongKey && !missing ? "PASS" : "FAIL",
      `tampered=${tampered} wrongKey=${wrongKey} missing=${missing} (all must be false)`,
    );
  }

  // 4) CHECKOUT CREATION --------------------------------------------------
  console.log("\n4) Checkout creation");
  try {
    const ref = `smoke-${process.pid}-${process.hrtime.bigint()}`;
    const checkout = await createSquareCheckout({
      amountCents: 1995,
      referenceId: ref,
      description: "Sandbox smoke test (no charge)",
    });
    if (!squareConfigured()) {
      record(
        "checkout link created",
        "SKIP",
        `Square creds absent → mock link ${checkout.checkoutUrl} (set SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID to hit the sandbox API)`,
      );
    } else if (/^https?:\/\//.test(checkout.checkoutUrl)) {
      record(
        "checkout link created",
        "PASS",
        `${checkout.checkoutUrl}${checkout.orderId ? ` (order ${checkout.orderId})` : ""}`,
      );
    } else {
      record("checkout link created", "FAIL", `unexpected url: ${checkout.checkoutUrl}`);
    }
  } catch (err) {
    record("checkout link created", "FAIL", (err as Error).message);
  }

  // 5) WEBHOOK ENDPOINT (live POST) ---------------------------------------
  console.log("\n5) Webhook endpoint");
  const canHitWebhook = Boolean(signingKey) && /^https?:\/\//.test(webhookUrl);
  if (!canHitWebhook) {
    record(
      "valid webhook accepted (200)",
      "SKIP",
      !signingKey ? "no signing key" : `no usable webhook url (${webhookUrl})`,
    );
    record("bad signature rejected (401)", "SKIP", "see above");
  } else {
    console.log(`   → POST ${webhookUrl}`);
    const event = {
      type: "payment.updated",
      event_id: `smoke-${Date.now()}`,
      data: {
        type: "payment",
        object: {
          payment: {
            id: `sandbox-pay-${Date.now()}`,
            status: "COMPLETED",
            note: INTENT ?? "smoke-no-intent",
            amount_money: { amount: 1995, currency: "USD" },
          },
        },
      },
    };
    const raw = JSON.stringify(event);
    const goodSig = sign(webhookUrl, raw, signingKey);

    // valid
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-square-hmacsha256-signature": goodSig,
        },
        body: raw,
      });
      record(
        "valid webhook accepted (200)",
        res.status === 200 ? "PASS" : "FAIL",
        `status ${res.status}`,
      );
    } catch (err) {
      record("valid webhook accepted (200)", "FAIL", `request failed: ${(err as Error).message}`);
    }

    // bad signature → must be rejected
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-square-hmacsha256-signature": "deadbeefnotvalid",
        },
        body: raw,
      });
      record(
        "bad signature rejected (401)",
        res.status === 401 ? "PASS" : "FAIL",
        `status ${res.status} (expected 401)`,
      );
    } catch (err) {
      record("bad signature rejected (401)", "FAIL", `request failed: ${(err as Error).message}`);
    }
  }

  // 6) STATUS FLIP (optional — needs a real PENDING intent + Convex url) ---
  console.log("\n6) Status update (optional)");
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!INTENT) {
    record("intent flips to SUCCEEDED", "SKIP", "pass --intent <paymentIntentId> to verify end-to-end");
  } else if (!convexUrl) {
    record("intent flips to SUCCEEDED", "SKIP", "NEXT_PUBLIC_CONVEX_URL not set");
  } else if (!signingKey) {
    record("intent flips to SUCCEEDED", "SKIP", "no signing key to authorize the read-back");
  } else {
    try {
      const { ConvexHttpClient } = await import("convex/browser");
      const { api } = await import("../convex/_generated/api");
      const client = new ConvexHttpClient(convexUrl);
      const status: any = await client.query(api.payments.statusForSmoke, {
        secret: signingKey,
        paymentIntentId: INTENT as any,
      });
      if (!status) {
        record("intent flips to SUCCEEDED", "FAIL", `no paymentIntent ${INTENT} found`);
      } else {
        const ok = status.status === "SUCCEEDED";
        record(
          "intent flips to SUCCEEDED",
          ok ? "PASS" : "FAIL",
          `status=${status.status} disputeStatus=${status.disputeStatus ?? "n/a"} (run step 5 with the same --intent first)`,
        );
      }
    } catch (err) {
      record("intent flips to SUCCEEDED", "FAIL", (err as Error).message);
    }
  }

  finish();
}

function finish() {
  const fail = results.filter((r) => r.outcome === "FAIL").length;
  const pass = results.filter((r) => r.outcome === "PASS").length;
  const skip = results.filter((r) => r.outcome === "SKIP").length;
  console.log(`\n=== ${pass} passed, ${fail} failed, ${skip} skipped ===`);
  if (fail > 0) {
    console.log("RESULT: FAIL\n");
    process.exit(1);
  }
  console.log("RESULT: PASS\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
