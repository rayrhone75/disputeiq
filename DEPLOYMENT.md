# DisputeIQ — Deployment

Production brand: **DisputeIQ** · production domain: **disputeiq.org**

| Host                    | Purpose                                  | Status   |
| ----------------------- | ---------------------------------------- | -------- |
| disputeiq.org           | Marketing + dashboard + admin + API      | live     |
| www.disputeiq.org       | Marketing site (redirect to apex)        | live     |

Single-domain topology — everything (`/`, `/dashboard`, `/admin`, `/api/*`) is served from `disputeiq.org`. The `middleware.ts` only handles Clerk auth gates.

Backend stack: **Convex** (database + functions) and **Clerk** (auth). There is no relational database, no ORM migration step, and no NextAuth in this deployment.

---

## Production environment variables

Set these in Vercel project settings or `.env` on the VPS:

```
ENCRYPTION_KEY=<32+ chars>

# Convex — values come from `npx convex deploy` against the prod deployment
NEXT_PUBLIC_CONVEX_URL=https://<your-prod>.convex.cloud
CONVEX_DEPLOYMENT=prod:<your-prod>

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

APP_BASE_URL=https://disputeiq.org
MARKETING_BASE_URL=https://disputeiq.org
NEXT_PUBLIC_APP_URL=https://disputeiq.org
NEXT_PUBLIC_MARKETING_URL=https://disputeiq.org
ADMIN_BASE_URL=https://disputeiq.org/admin
API_BASE_URL=https://disputeiq.org/api

SQUARE_ACCESS_TOKEN=...
SQUARE_LOCATION_ID=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...
SQUARE_API_BASE=https://connect.squareup.com

LETTERSTREAM_API_KEY=...
LETTERSTREAM_API_SECRET=...
LETTERSTREAM_API_BASE=https://www.letterstream.com/apis/

# MyScoreIQ — supported credit-report provider for new customers
MYSCOREIQ_AFFILIATE_URL=https://member.myscoreiq.com/get-fico-preferred.aspx?offercode=43214399
MYSCOREIQ_JSON_REPORT_URL=https://member.myscoreiq.com/CreditReport.aspx?view=json

# MFSN — retired; vars kept only so the legacy callback route 410s cleanly
MFSN_API_KEY=...
MFSN_AFFILIATE_LINK=...
MFSN_CALLBACK_URL=https://disputeiq.org/api/mfsn/callback

STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

## Webhook + callback URLs to register

| Provider     | URL                                                          |
| ------------ | ------------------------------------------------------------ |
| Square       | `https://disputeiq.org/api/webhooks/square`                  |
| LetterStream | `https://disputeiq.org/api/webhooks/letterstream`            |
| MFSN         | `https://disputeiq.org/api/mfsn/callback` (returns 410)      |

---

## Path A — Vercel (fastest)

1. Push the repo to GitHub.
2. In Vercel → Import Project → select repo. Framework: Next.js (auto).
3. Vercel → Settings → Domains, add:
   - `disputeiq.org`
   - `www.disputeiq.org` (redirect to apex)
4. Vercel will give you DNS targets. In your DNS provider for `disputeiq.org`:
   - **A** `@` → Vercel apex IP shown in the UI
   - **CNAME** `www` → `cname.vercel-dns.com.`
5. Set all env vars from the table above in Vercel → Settings → Environment Variables.
6. Deploy Convex functions to the production deployment once: `npx convex deploy --prod`.
7. Trigger a Vercel deploy. Vercel issues SSL automatically.
8. Register the webhook URLs with Square and LetterStream.

---

## Path B — Hostinger VPS (Node + PM2 + Nginx)

### 1. Server prep
```bash
sudo apt update && sudo apt install -y curl git nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 2. Clone + build
```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www
cd /var/www
git clone <your-repo-url> disputeiq
cd disputeiq
cp .env.example .env   # then fill in production values
npm ci
npm run build
```

### 3. Push Convex schema/functions to the prod deployment
Run this once after any change to `convex/`:
```bash
npx convex deploy --prod
```

### 4. Start with PM2
```bash
pm2 start deploy/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup    # follow the printed command
```

### 5. Nginx + SSL
```bash
sudo cp deploy/nginx/disputeiq.conf /etc/nginx/sites-available/disputeiq.conf
sudo ln -s /etc/nginx/sites-available/disputeiq.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d disputeiq.org -d www.disputeiq.org \
  -d app.disputeiq.org \
  -d admin.disputeiq.org -d api.disputeiq.org
```

### 6. DNS records
Point everything at the VPS IP:
- **A** `@` → `<VPS_IP>`
- **A** `www` → `<VPS_IP>`
- **A** `app` → `<VPS_IP>`
- **A** `admin` → `<VPS_IP>`
- **A** `api` → `<VPS_IP>`

### 7. Updates
```bash
cd /var/www/disputeiq
git pull
npm ci
npx convex deploy --prod   # only when convex/ changed
npm run build
pm2 reload disputeiq
```

---

## Path C — Docker on VPS

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
```
Convex functions still deploy from your workstation with `npx convex deploy --prod`. Then put the same Nginx config in front of `127.0.0.1:3000`.

---

## Compliance launch gate
- [ ] Disclosures reviewed by counsel
- [ ] Affiliate disclosure published at /trust-center
- [ ] No "guaranteed deletion" copy anywhere
- [ ] Audit log writes verified for every state-changing route
- [ ] User confirmation gates verified on dispute create, payment, mailing, shadow-strike, 605B
- [ ] Webhook HMAC verified for Square in production
- [ ] No raw letter PDFs are downloadable before payment + confirmation
