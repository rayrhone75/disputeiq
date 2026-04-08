# DisputeIQ — Deployment

Production brand: **DisputeIQ** · production domain: **disputeiq.org**

| Host                    | Purpose                          | Status   |
| ----------------------- | -------------------------------- | -------- |
| disputeiq.org           | Marketing site                   | live     |
| www.disputeiq.org       | Marketing site (redirect)        | live     |
| app.disputeiq.org       | Application (dashboard + API)    | live     |
| admin.disputeiq.org     | Reserved (rewrites to /admin/*)  | reserved |
| api.disputeiq.org       | Reserved (rewrites to /api/*)    | reserved |

The Next.js middleware (`middleware.ts`) handles subdomain routing in a single deployment. Split into separate deployments later if/when scale demands it.

---

## Production environment variables

Set these in Vercel project settings or `.env` on the VPS:

```
DATABASE_URL=postgresql://USER:PASS@HOST:5432/disputeiq
NEXTAUTH_SECRET=<32+ chars>
ENCRYPTION_KEY=<32+ chars>

APP_BASE_URL=https://app.disputeiq.org
MARKETING_BASE_URL=https://disputeiq.org
NEXT_PUBLIC_APP_URL=https://app.disputeiq.org
NEXT_PUBLIC_MARKETING_URL=https://disputeiq.org
ADMIN_BASE_URL=https://admin.disputeiq.org
API_BASE_URL=https://api.disputeiq.org

SQUARE_ACCESS_TOKEN=...
SQUARE_LOCATION_ID=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...
SQUARE_API_BASE=https://connect.squareup.com

LETTERSTREAM_API_KEY=...
LETTERSTREAM_API_SECRET=...
LETTERSTREAM_API_BASE=https://www.letterstream.com/apis/

MFSN_API_KEY=...
MFSN_AFFILIATE_LINK=...
MFSN_CALLBACK_URL=https://app.disputeiq.org/api/mfsn/callback

STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

## Webhook + callback URLs to register

| Provider     | URL                                                          |
| ------------ | ------------------------------------------------------------ |
| Square       | `https://app.disputeiq.org/api/webhooks/square`              |
| LetterStream | `https://app.disputeiq.org/api/webhooks/letterstream`        |
| MFSN         | `https://app.disputeiq.org/api/mfsn/callback`                |
| Auth         | `https://app.disputeiq.org/api/auth/callback/<provider>`     |

---

## Path A — Vercel + Hostinger DNS (fastest)

1. Push the repo to GitHub.
2. In Vercel → Import Project → select repo. Framework: Next.js (auto).
3. Vercel → Settings → Domains, add:
   - `disputeiq.org`
   - `www.disputeiq.org` (redirect to apex)
   - `app.disputeiq.org`
   - (optional, reserved) `admin.disputeiq.org`, `api.disputeiq.org`
4. Vercel will give you DNS targets. In Hostinger → DNS Zone for `disputeiq.org`:
   - **A** `@` → `76.76.21.21` (Vercel apex IP — Vercel UI shows the current value, use that)
   - **CNAME** `www` → `cname.vercel-dns.com.`
   - **CNAME** `app` → `cname.vercel-dns.com.`
   - **CNAME** `admin` → `cname.vercel-dns.com.` *(when ready)*
   - **CNAME** `api` → `cname.vercel-dns.com.` *(when ready)*
5. Set all env vars from the table above in Vercel → Settings → Environment Variables.
6. Trigger a deploy. Vercel issues SSL automatically.
7. Register the webhook URLs with Square and LetterStream.
8. Run `npx prisma migrate deploy` against the production DB once (use a local shell with `DATABASE_URL` pointed at prod, or a Vercel build hook).

---

## Path B — Hostinger VPS (Node + PM2 + Nginx)

### 1. Server prep
```bash
sudo apt update && sudo apt install -y curl git nginx postgresql ufw
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
npx prisma migrate deploy
npm run build
```

### 3. Start with PM2
```bash
pm2 start deploy/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup    # follow the printed command
```

### 4. Nginx + SSL
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

### 5. Hostinger DNS records
In Hostinger → DNS Zone for `disputeiq.org`, point everything at the VPS IP:
- **A** `@` → `<VPS_IP>`
- **A** `www` → `<VPS_IP>`
- **A** `app` → `<VPS_IP>`
- **A** `admin` → `<VPS_IP>`
- **A** `api` → `<VPS_IP>`

### 6. Updates
```bash
cd /var/www/disputeiq
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload disputeiq
```

---

## Path C — Docker on VPS

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```
Then put the same Nginx config in front of `127.0.0.1:3000`.

---

## Compliance launch gate
- [ ] Disclosures reviewed by counsel
- [ ] Affiliate disclosure published at /trust-center
- [ ] No "guaranteed deletion" copy anywhere
- [ ] Audit log writes verified for every state-changing route
- [ ] User confirmation gates verified on dispute create, payment, mailing, shadow-strike, 605B
- [ ] Webhook HMAC verified for Square in production
- [ ] No raw letter PDFs are downloadable before payment + confirmation
