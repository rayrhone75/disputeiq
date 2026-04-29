# DisputeIQ Connector — Chrome Extension

One-click MyScoreIQ credit-report import for DisputeIQ users. The extension reads the JSON your authenticated MyScoreIQ tab is already showing and POSTs it to DisputeIQ over HTTPS, signed with a token unique to your account.

**The extension never asks for or stores your MyScoreIQ password.**

---

## Architecture (Phase 1)

```
extension/
├── manifest.json          # Manifest V3, host_permissions for myscoreiq + disputeiq
├── tsconfig.json          # Extension-only TS config (chrome types)
├── build.mjs              # esbuild bundler → extension/dist/
├── icons/                 # 16/48/128 PNG (placeholder, swap before Web Store submission)
└── src/
    ├── manifest.json      # (copied to dist by build)
    ├── background.ts      # Service worker. Auth, message routing, network calls
    ├── contentScript.ts   # Injected into member.myscoreiq.com tabs. Reads JSON
    ├── popup.html
    ├── popup.ts           # Pair UI + import button
    ├── api.ts             # Typed DisputeIQ API client (pair/complete, status, import)
    ├── storage.ts         # chrome.storage.local wrappers for pairing + last-import
    └── security.ts        # Token redaction + payload-summary helpers (no PII in logs)
```

Backend that lives in the main repo (already wired):

```
app/api/extension/
├── pair/start/route.ts       # Clerk-auth → 5-min pair token + 6-letter display code
├── pair/complete/route.ts    # Pair token → 90-day extension token; records pairing
├── status/route.ts           # GET /status — health check, returns user + last import
└── import/myscoreiq/route.ts # POST raw JSON → runs createImport→captureRaw→runNormalization

convex/extensionPairings.ts   # listMine, revokeMine, createPairing, lookupActiveByTokenHash, …
lib/auth/extension-token.ts   # HMAC sign/verify with purpose binding
```

---

## Build

The extension is built by esbuild into `extension/dist/`. Two modes:

```bash
# Production build (minified, no source maps)
npm run extension:build

# Dev watch mode (rebuilds on save, source maps inline)
npm run extension:dev

# Production zip ready for Chrome Web Store upload (requires `bestzip` global, optional)
npm run extension:zip
```

Origin is baked at build time via the `DISPUTEIQ_ORIGIN` env var:

```bash
# Local dev (must match your Next.js dev server)
DISPUTEIQ_ORIGIN=http://localhost:3000 npm run extension:build

# Production (default)
DISPUTEIQ_ORIGIN=https://disputeiq.org npm run extension:build
```

If you build for one origin and try to pair against the other, `pair/complete` will hit CORS and fail.

---

## Load unpacked (development)

1. Build: `DISPUTEIQ_ORIGIN=http://localhost:3000 npm run extension:build`
2. Run the Next.js dev server: `npm run dev` (so the extension has an API to talk to)
3. Open Chrome → `chrome://extensions`
4. Toggle **Developer mode** on (top right)
5. Click **Load unpacked** → select `extension/dist/`
6. Pin the **DisputeIQ Connector** icon to the toolbar

---

## Pair to your DisputeIQ account

1. Sign into DisputeIQ at `http://localhost:3000` (or `https://disputeiq.org` for prod).
2. Visit `/dashboard/get-report`.
3. Find the **Chrome extension import** card.
4. Click **Generate pairing token**. The card shows:
   - A 6-letter display code (e.g. `KQ7M9P`) — this is the human-readable thumbprint, useful for support to confirm the right token over the phone.
   - The full pairing token (long base64-url string) — paste this into the extension popup.
5. Click the DisputeIQ Connector toolbar icon → paste the full token → click **Pair Extension**.
6. Popup flips to the paired state showing your DisputeIQ email.

Pair token TTL is 5 minutes. If you're slow, just generate a new one.

---

## Import flow

After pairing:

1. Open the extension popup → click **Import MyScoreIQ Report**.
2. Three things can happen:
   - **You have a MyScoreIQ JSON tab open and you're signed in.** The extension reads the body, POSTs to DisputeIQ, dashboard updates within seconds. Popup shows tradeline count + a link back to the dashboard.
   - **You have a MyScoreIQ tab open but it's the login page.** Extension brings that tab forward and tells you to sign in, then click Import again.
   - **No MyScoreIQ tab is open.** Extension opens the JSON URL in a new tab. If MyScoreIQ shows the JSON, click Import again. If it redirects you to login, sign in then click Import again.

The extension **never** runs without you clicking Import. There's no background polling, no scheduled task.

---

## Security model

| Concern | Mitigation |
|---|---|
| MyScoreIQ password storage | Never asked, never stored. Extension only reads the JSON your authenticated browser already loaded. |
| Token leak in DisputeIQ DB | We store **SHA-256 of the extension token**, never the raw value. A leak of `extensionPairings` cannot impersonate the extension. |
| Token leak in browser storage | The token is in `chrome.storage.local`, scoped to the extension id. Other websites cannot read it. The user can revoke any time from the dashboard. |
| Pair token replay | Pair tokens are signed with `purpose: "extension-pair"` and TTL 5 min. They cannot be replayed at `/import/myscoreiq` (purpose binding) and they expire fast. |
| Wrong-purpose token | Both `verifyExtensionToken` and the route handlers assert `purpose` matches expected. A token issued for one endpoint cannot authenticate to another. |
| Body size DoS | 25 MB hard cap at the import endpoint. |
| JSON shape | Server-side: must start with `{` or `[` and `JSON.parse` must succeed before payload reaches the runner. |
| Extension talking to wrong host | `host_permissions` only includes `member.myscoreiq.com`, `disputeiq.org`, `localhost:3000`. The extension cannot send your data anywhere else. |
| Audit trail | Every pair, attempt, success, failure, and revoke is recorded in `auditLogs` with action prefix `EXTENSION_*`. |
| PII in logs | The content script logs only payload size + a non-cryptographic FNV-1a hash, never the body. The service worker never logs raw JSON. |

---

## Test checklist

### Unit
- [x] `lib/auth/__tests__/bookmarklet-token.test.ts` — 8 cases for the existing bookmarklet token (sister to extension token; identical primitives)
- [ ] `lib/auth/__tests__/extension-token.test.ts` — TODO: roundtrip, wrong purpose, expired, tampered

### Local end-to-end
- [ ] Build extension (`npm run extension:build`), load unpacked
- [ ] Pair → popup flips to paired state, shows email
- [ ] `/dashboard/get-report` shows the pairing in the "Paired extensions" list
- [ ] With a MyScoreIQ JSON tab open + logged in: click Import → success card with tradeline count
- [ ] With a MyScoreIQ login page open: click Import → "log in, then retry" message
- [ ] With no MyScoreIQ tab: click Import → opens JSON URL in new tab
- [ ] Click **Disconnect** in popup → next status call returns 401 → re-pair flow

### Security
- [x] `POST /api/extension/pair/start` without Clerk session → 401
- [x] `POST /api/extension/pair/complete` without pair token → 400
- [x] `GET /api/extension/status` without bearer → 401
- [x] `POST /api/extension/import/myscoreiq` without bearer → 401
- [x] CORS preflight on `/import/myscoreiq` → 204 with proper headers
- [ ] Tamper a pair token → 401 INVALID_SIGNATURE
- [ ] Submit pair token to `/import/myscoreiq` → 401 WRONG_PURPOSE
- [ ] Body > 25 MB → 413 BODY_TOO_LARGE
- [ ] Non-JSON body → 400 NOT_JSON
- [ ] Revoke from dashboard → next import call returns 401 PAIRING_REVOKED_OR_MISSING

---

## Deferred to next session (Phase 3 + 4)

- Polished onboarding flow (first-run welcome page, options page)
- Designed icons (16/48/128 — replace the placeholder transparent PNGs in `extension/icons/`)
- Privacy policy doc at `disputeiq.org/extension-privacy` (Web Store submission requires a published URL)
- Chrome Web Store listing copy + screenshots
- Web Store submission ($5 dev account, ZIP upload, ~1–7 day review)
- Auto-update channel (Chrome handles this automatically once published)

---

## Production deploy

The extension code does **not** auto-deploy with the main app — Vercel only builds Next.js. The extension's API (the four `/api/extension/*` routes + Convex schema) DOES deploy with the main app, so the backend is already live in production.

For now, in Phase 1, the extension is **distributed as `extension/dist/`**. Anyone wanting to install it must:
1. Clone the repo or download the latest `extension/dist/` artifact.
2. Load unpacked from `chrome://extensions`.

Once Phase 4 (Web Store) ships, distribution moves to the Web Store URL.
