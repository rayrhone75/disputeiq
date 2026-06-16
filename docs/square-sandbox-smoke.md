# Square Sandbox Smoke Test

Verifies the one-time ("packet") payment path end-to-end **without charging a real
customer**. Square is the primary one-time provider; Stripe stays the fallback +
subscription provider. Run this against Square **sandbox** before switching on live keys.

Script: `scripts/square-sandbox-smoke.ts` · Run with: `npm run square:smoke`

---

## What it checks

| # | Test | How it's proven | Needs |
|---|------|-----------------|-------|
| 1 | **Safety** — won't touch production | Aborts if `SQUARE_ENVIRONMENT=production` (unless `--force`) | nothing |
| 2 | **Signature accepted** | A correctly-signed body passes `verifySquareSignature` | `SQUARE_WEBHOOK_SIGNATURE_KEY` |
| 3 | **Bad signatures rejected** | Tampered body / wrong key / missing header all fail | `SQUARE_WEBHOOK_SIGNATURE_KEY` |
| 4 | **Checkout link created** | `createSquareCheckout()` returns a sandbox link (or a mock link if creds absent) | `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` for a real call |
| 5 | **Webhook endpoint live** | POSTs a synthetic `payment.updated`: valid sig → `200 {received:true}`, bad sig → `401` | a running endpoint + signing key |
| 6 | **Status flips** (optional) | After the signed webhook, confirms the intent is `SUCCEEDED` + case `PAID` via a secret-guarded read-back | `--intent <id>` + `NEXT_PUBLIC_CONVEX_URL` |

No real card is ever used. The payload in steps 5–6 is synthetic; step 4 only creates a
payment **link** (no charge).

---

## 1. Get Square sandbox credentials

1. Sign in at <https://developer.squareup.com/apps> → open (or create) an application.
2. Switch the dashboard toggle to **Sandbox**.
3. From **Credentials (Sandbox)** copy:
   - **Sandbox Access Token** → `SQUARE_ACCESS_TOKEN`
   - **Location ID** (Locations tab, sandbox) → `SQUARE_LOCATION_ID`

## 2. Register the webhook (sandbox)

1. In the app → **Webhooks → Subscriptions → Add Endpoint** (Sandbox).
2. **URL**: the exact public URL of your endpoint, e.g.
   `https://<your-vercel-preview>/api/webhooks/square`
   (for local testing, expose `localhost:3000` via a tunnel like `ngrok` and use that URL).
3. **Events**: subscribe to `payment.created` and `payment.updated`.
4. Save, then copy the **Signature Key** → `SQUARE_WEBHOOK_SIGNATURE_KEY`.
5. Set `SQUARE_WEBHOOK_NOTIFICATION_URL` to the **exact** URL from step 2. Signature
   verification hashes `notificationURL + body`, so this must match character-for-character.

## 3. Env vars (`.env.local` for local, or the Vercel "Preview" env)

```bash
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=EAAA...            # sandbox token
SQUARE_LOCATION_ID=L...                # sandbox location
SQUARE_WEBHOOK_SIGNATURE_KEY=...       # from the webhook subscription
SQUARE_WEBHOOK_NOTIFICATION_URL=https://<host>/api/webhooks/square
APP_BASE_URL=https://<host>            # used for redirect URLs
NEXT_PUBLIC_CONVEX_URL=https://<dep>.convex.cloud   # for test #6
```

> The smoke script auto-loads `.env.local` then `.env`. It signs the webhook with the
> **same** notification URL the server derives, so the script's env and the server's env
> must agree on `SQUARE_WEBHOOK_NOTIFICATION_URL` (or `APP_BASE_URL`).

---

## 4. Run it

**Offline (no creds)** — proves the harness + signature logic only:
```bash
SQUARE_ENVIRONMENT=sandbox SQUARE_WEBHOOK_SIGNATURE_KEY=any-test-key npm run square:smoke
```
Expect tests 2–3 PASS, the rest SKIP, `RESULT: PASS`.

**Against a running endpoint** (local `next dev` via tunnel, or a Vercel Preview):
```bash
npm run square:smoke
```
Expect tests 1–5 PASS (test 4 PASS only with sandbox token).

**Full end-to-end** — verify the DB actually flips. First create a real **$X** dispute
checkout in the app (so a `PENDING` Square paymentIntent exists), grab its id, then:
```bash
npm run square:smoke -- --intent <paymentIntentId>
```
The signed webhook in test 5 carries that id as the payment `note`; test 6 reads the
intent back and expects `SUCCEEDED`.

Useful flags: `--webhook-url <url>` (override the POST target) · `--force` (allow a
non-sandbox env — avoid unless you know why).

---

## 5. PASS / FAIL meaning

- **`RESULT: PASS` (exit 0)** — every non-skipped check passed. The Square checkout
  call, signature scheme, and webhook endpoint behave correctly; with `--intent`, a paid
  webhook correctly marks the intent `SUCCEEDED` and the dispute case `PAID`.
- **`RESULT: FAIL` (exit 1)** — at least one check failed. Common causes:
  - *Test 1 fails* → `SQUARE_ENVIRONMENT` is `production`. This is the safety net; switch to sandbox.
  - *Test 3 fails* → signature is NOT failing closed; do **not** ship — a bad signature must be rejected.
  - *Test 5 valid≠200* → the endpoint isn't reachable, or the server's notification URL / signing key
    differ from the script's. Make `SQUARE_WEBHOOK_NOTIFICATION_URL` identical on both sides.
  - *Test 5 bad≠401* → the endpoint is accepting unsigned requests — a security bug; do not ship.
  - *Test 6 not SUCCEEDED* → the `note → paymentIntents._id` reconciliation didn't land; check that
    the intent id is real and `PENDING`, and that you ran test 5 with the same `--intent`.
- **SKIP** — a prerequisite env var/flag wasn't provided; not a failure, just not exercised.

`SKIP`s don't fail the run. Aim for tests 1–5 PASS before enabling live keys, and run the
full `--intent` flow once for end-to-end confidence.

---

## 6. Going live

After sandbox passes: create the **production** webhook subscription + credentials in the
Square dashboard, set the same env var names with production values, and set
`SQUARE_ENVIRONMENT=production`. Leave Stripe (`STRIPE_*`) configured — it remains the
subscription provider and the automatic fallback when Square isn't configured.
