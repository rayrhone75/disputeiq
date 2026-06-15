# Deploying the DisputeIQ Connector Worker

This service runs Playwright + Chromium to log into credit-monitoring
providers. **It cannot run on Vercel serverless** — deploy it to a
long-running container/VM. Vercel calls it over HTTPS.

```
┌─────────────┐   HTTPS + Bearer secret    ┌──────────────────────────┐
│  Vercel app │ ─────────────────────────► │  connector-worker (this) │
│ (Next.js)   │ ◄───────────────────────── │  Playwright + Chromium   │
└─────────────┘   report HTML / test JSON  └──────────────────────────┘
```

---

## 0. What you need before deploying
- A strong shared secret: `openssl rand -hex 32` → use as `CONNECTOR_WORKER_SECRET`.
- A host that gives you a public HTTPS URL (Fly.io, Railway, Render, or a VPS + Caddy/nginx).
- ~1–2 GB RAM (Chromium is memory-hungry; 512 MB will OOM under load).

### Worker env vars
| Var | Value |
|-----|-------|
| `PORT` | `8787` (or host-injected) |
| `CONNECTOR_WORKER_SECRET` | the random secret (must match Vercel) |
| `DIAGNOSTICS_DIR` | `./diagnostics` (or a mounted volume) |

### Vercel env vars (set these in the DisputeIQ project)
| Var | Value |
|-----|-------|
| `CONNECTOR_WORKER_URL` | the worker's public base URL, e.g. `https://connect.disputeiq.org` |
| `CONNECTOR_WORKER_SECRET` | **same** secret as the worker |
| `FEATURE_CREDIT_CONNECTORS` | `true` when ready |
| `FEATURE_MYSCOREIQ_CONNECTOR` / `FEATURE_MYFREESCORENOW_CONNECTOR` | `true` per provider |
| `CREDIT_CONNECTOR_VAULT_KEY` | ≥32-char key (remember-login) |
| `CREDIT_REPORT_ENCRYPTION_KEY` | ≥32-char key (report drafts) |

---

## Option A — Fly.io (recommended, simplest)

1. Install flyctl and sign in: `fly auth login`.
2. From the repo root:
   ```bash
   cd connector-worker
   fly launch --no-deploy        # creates the app; pick a name + region
   ```
3. Create `fly.toml` (or let launch generate it, then match this):
   ```toml
   app = "disputeiq-connector"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [http_service]
     internal_port = 8787
     force_https = true
     auto_stop_machines = "suspend"
     auto_start_machines = true
     min_machines_running = 0

   [http_service.checks]
     [[http_service.checks.http]]
       path = "/healthz"
       interval = "30s"
       timeout = "5s"

   [[vm]]
     memory = "2gb"
     cpu_kind = "shared"
     cpus = 1
   ```
4. Set the secret and deploy:
   ```bash
   fly secrets set CONNECTOR_WORKER_SECRET=<your-secret>
   fly deploy
   ```
5. Your URL is `https://<app-name>.fly.dev` → put that in Vercel's `CONNECTOR_WORKER_URL`.

> The Dockerfile already uses `mcr.microsoft.com/playwright:...-jammy`, which
> ships Chromium + system deps, so no extra browser install step is needed.

---

## Option B — Railway

1. New Project → Deploy from GitHub repo.
2. Set **Root Directory** to `connector-worker` and **Builder** to Dockerfile.
3. Variables: `CONNECTOR_WORKER_SECRET`, `PORT=8787`.
4. Networking → expose port `8787`; Railway gives you a public domain.
5. Use that domain as Vercel's `CONNECTOR_WORKER_URL`.

## Option C — Render

1. New → Web Service → your repo, **Root Directory** `connector-worker`,
   **Runtime** Docker.
2. Instance type with ≥2 GB RAM. Health check path `/healthz`.
3. Env: `CONNECTOR_WORKER_SECRET`. Render injects `PORT` automatically (the
   server reads `process.env.PORT`).

---

## Option D — Docker on your own VPS

```bash
# on the VPS, with the repo checked out
cd connector-worker
docker build -t disputeiq-connector .
docker run -d --name connector \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -e CONNECTOR_WORKER_SECRET=<your-secret> \
  -e PORT=8787 \
  -v /var/lib/connector-diagnostics:/app/diagnostics \
  disputeiq-connector
```

Then put TLS in front (Caddy is easiest):
```
# /etc/caddy/Caddyfile
connect.disputeiq.org {
    reverse_proxy 127.0.0.1:8787
}
```
`sudo systemctl reload caddy`. Now `https://connect.disputeiq.org` is your
`CONNECTOR_WORKER_URL`. (Caddy auto-provisions a Let's Encrypt cert.)

> Binding the container to `127.0.0.1` means only the reverse proxy can
> reach it — the worker is never exposed directly to the internet.

---

## Verify the deploy

```bash
# 1. liveness (no auth)
curl https://YOUR-WORKER/healthz
# → {"ok":true,"ts":...}

# 2. provider health (auth required) — should be GREEN if selectors match
curl https://YOUR-WORKER/v1/health \
  -H "Authorization: Bearer $CONNECTOR_WORKER_SECRET"
# → {"providers":[{"provider":"MYSCOREIQ","status":"GREEN",...}, ...]}
```

From the app side, after setting the Vercel env vars and redeploying:
- Visit **`/admin/connectors`** (as an admin) → flags green, providers reachable.
- Visit **`/admin/connectors/myscoreiq-test`** → enter real test credentials →
  **Run live test** → watch the screenshots + detection checklist. Tune the
  selector arrays in `src/connectors/myscoreiq.ts` /
  `src/connectors/myfreescorenow.ts` until the status is **GREEN**, then
  redeploy the worker.

---

## Security checklist
- `CONNECTOR_WORKER_SECRET` is long, random, and identical on both sides. Rotate it by updating both env values.
- Worker is reachable **only over HTTPS** (Fly/Railway/Render terminate TLS; on a VPS use Caddy/nginx).
- No passwords/SSN are ever logged, screenshotted, or written to filenames (enforced in `base.ts`). The worker stores nothing at rest except diagnostic screenshots under `DIAGNOSTICS_DIR`.
- Consider periodically clearing `DIAGNOSTICS_DIR` (screenshots can contain on-screen report data). A simple cron: `find $DIAGNOSTICS_DIR -type f -mtime +7 -delete`.
- Restrict who can hit `/admin/connectors/*` — those pages drive live logins.

## Performance / scaling
- Each `/v1/import` or `/v1/test` launches its own Chromium and closes it — clean but ~300–600 MB peak per request. Size memory accordingly.
- For concurrency, scale horizontally (more machines/instances) rather than packing many browsers into one small box.
- Set generous request timeouts on the proxy (logins can take 30–60s); the Vercel client already allows up to 180s.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| `/admin/connectors` shows RED + "worker unreachable" | `CONNECTOR_WORKER_URL` wrong, or worker down |
| `401 UNAUTHORIZED` from worker | secret mismatch between Vercel and worker |
| Health `RED`, test shows login/username/password not found | provider markup changed → update selectors |
| Worker crashes/OOMs on first request | not enough RAM — bump to 2 GB |
| `BROWSER` errors locally | run `npm run install-browser` (Docker image already has it) |
