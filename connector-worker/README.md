# DisputeIQ Connector Worker

Runs the Playwright-based credit-monitoring connectors (MyScoreIQ,
MyFreeScoreNow). **This service must NOT be deployed to Vercel serverless**
— full Chromium can't run there. Deploy it to a VPS / Docker container /
Fly.io / Railway / a long-running Node host. The Vercel app calls this
worker's HTTP API.

**Deploying?** See [DEPLOY.md](./DEPLOY.md) for Fly.io / Railway / Render /
VPS guides and the exact Vercel wiring.

## Run locally
```bash
cd connector-worker
cp .env.example .env        # set CONNECTOR_WORKER_SECRET
npm install
npm run install-browser     # playwright install chromium
npm run dev                 # http://localhost:8787
```

## Endpoints (all /v1/* require `Authorization: Bearer $CONNECTOR_WORKER_SECRET`)
- `POST /v1/import` `{ provider, credentials:{username,password,last4SSN?}, mfaCode? }` → report HTML + checks
- `POST /v1/test`   same body → diagnostics with base64 screenshots (before-login, after-login, report-page, error-page)
- `GET  /v1/health` → `{ providers: [{ provider, status, checks }] }` (GREEN / YELLOW / RED)
- `GET  /v1/health/:provider`
- `GET  /healthz` → liveness (no auth)

## Vercel side
Set in the Vercel env:
- `CONNECTOR_WORKER_URL` = this service's base URL (e.g. https://connect.yourhost.com)
- `CONNECTOR_WORKER_SECRET` = same secret as here

## Security
- No password / SSN is ever written to logs, screenshots, or filenames.
- Screenshots are written under `DIAGNOSTICS_DIR/<provider>/<session>/`.
- The Vercel app encrypts any stored credentials/report data; this worker
  holds nothing at rest beyond diagnostic screenshots.

## Docker (suggested)
Use `mcr.microsoft.com/playwright:v1.48.0-jammy` as the base image (ships
Chromium + system deps), copy this folder, `npm ci`, `npm run start`.
