# Connector-Worker Launch Checklist

Go-live checklist for the one-click credit-report auto-import. The worker runs
Playwright on a VPS/container; Vercel calls it over HTTPS. Full setup is in
[`DEPLOY.md`](./DEPLOY.md) — this is the ordered go-live list. Verify each box on the
admin pages noted at the end.

## A. Deploy the worker
- [ ] Pick a host with persistent compute + Chromium (NOT Vercel serverless). `fly.toml`
      is included → `fly launch` / `fly deploy`. Railway/Render/VPS also work (see DEPLOY.md).
- [ ] Build installs Chromium: `npm ci && npx playwright install --with-deps chromium`.
- [ ] Set worker env:
  - [ ] `CONNECTOR_WORKER_SECRET` — long random string (the shared bearer token)
  - [ ] `PORT` (default 8787) and `DIAGNOSTICS_DIR` (screenshot scratch dir)
- [ ] Confirm liveness: `curl https://<worker-host>/healthz` → `{ "ok": true }`.

## B. Wire Vercel → worker
- [ ] `CONNECTOR_WORKER_URL` = the worker's public HTTPS base URL
- [ ] `CONNECTOR_WORKER_SECRET` = **same** value as on the worker
- [ ] `CREDIT_CONNECTOR_VAULT_KEY` (≥32 chars) — only if offering "remember login"
- [ ] `CREDIT_REPORT_ENCRYPTION_KEY` (≥32 chars) — or it falls back to `ENCRYPTION_KEY`

## C. Feature flags (Vercel) — keep OFF until a provider tests GREEN
- [ ] `FEATURE_CREDIT_CONNECTORS=true` (master)
- [ ] `FEATURE_MYSCOREIQ_CONNECTOR=true` (after MyScoreIQ tests GREEN)
- [ ] `FEATURE_MYFREESCORENOW_CONNECTOR=true` (after MFSN tests GREEN)

## D. Verify on the admin pages
- [ ] **`/admin/diagnostics`** → "Connector worker" shows **Configured ✓ Reachable ✓**.
- [ ] **`/admin/connectors`** → worker reachable; providers listed.
- [ ] **`/admin/connectors/myscoreiq-test`** → enter a REAL MyScoreIQ login → status
      **GREEN**, screenshots show the logged-in 3-bureau report, "Report page reached" ✓.
- [ ] **`/admin/connectors/myfreescorenow-test`** → same with a real MyFreeScoreNow login
      (confirm the account is still viable first — MFSN was previously retired).
- [ ] End-to-end: from **`/dashboard/get-report`**, connect a real account → preview shows
      non-zero tradelines → save → import normalizes → AI analysis runs.

## E. Expect to tune (this is normal)
- [ ] Login selectors in `src/connectors/myscoreiq.ts` / `myfreescorenow.ts` if status is RED
      (`LAYOUT_CHANGED`). The test screenshots show exactly where it stalled.
- [ ] Report navigation/capture (`src/connectors/base.ts`) if logged-in but
      `REPORT_UNAVAILABLE` or zero tradelines — the page may need a click into the
      3-bureau view or a JSON/PDF download rather than scraped HTML.
- [ ] MFA: if the provider challenges on every login, a single `/v1/import` run can't
      complete with a code from a prior attempt — needs a persistent session (design note
      in the launch plan).

## PASS = ready to flip the flag
A provider is launch-ready when its `*-test` page is **GREEN** AND a real end-user run from
`/dashboard/get-report` produces an import with non-zero tradelines that flows into analysis.
Until then, leave its flag OFF — manual upload/paste remains the working fallback.
