# Chrome Web Store — Listing & Submission Checklist

This document is the source of truth for everything Google asks for
when we submit the **DisputeIQ Connector** to the Chrome Web Store.
Update it whenever the listing copy, screenshots, or permissions
change.

---

## 1. Item details

**Item name (max 75 chars)**
```
DisputeIQ Connector — One-click MyScoreIQ import
```

**Short description (max 132 chars)**
```
Import your MyScoreIQ tri-merge credit report into DisputeIQ in one click. Secure. We never see your password.
```

**Detailed description (max 16 000 chars)**

```
DisputeIQ Connector turns your authenticated MyScoreIQ credit-report tab into a one-click import for your DisputeIQ workspace.

WHO THIS IS FOR
- DisputeIQ.org customers (account required at https://disputeiq.org).
- People who already pay for MyScoreIQ for credit monitoring and want to dispute inaccuracies.

WHAT IT DOES
- Sends a copy of your MyScoreIQ tri-merge JSON report to your DisputeIQ workspace with one click.
- DisputeIQ then analyzes the report, ranks dispute opportunities, and helps you draft and mail dispute letters.

HOW IT WORKS
1. Install the Connector and pin its icon to your toolbar.
2. Generate a one-time pairing code on your DisputeIQ dashboard and paste it into the Connector popup.
3. Sign in to your MyScoreIQ account and open your credit report. The Connector reads only the JSON your authenticated browser has already loaded.
4. Click the Connector icon and hit Import. Your report lands in DisputeIQ in seconds.

PRIVACY & SECURITY
- The Connector NEVER sees your MyScoreIQ password. Login is handled entirely by MyScoreIQ in your own browser session — no credentials touch the extension or DisputeIQ servers.
- The Connector reads only the rendered text of your tri-merge JSON page on member.myscoreiq.com.
- Stored locally: the bearer token from your DisputeIQ pairing (in chrome.storage.local), the timestamp + outcome of the most recent import. Nothing else.
- Sent to DisputeIQ: the JSON body, your pairing-derived bearer token, and a short audit-log entry. The body is encrypted at rest by DisputeIQ.
- You can revoke the Connector instantly from the DisputeIQ dashboard.
- Full privacy policy: https://disputeiq.org/extension-privacy

PERMISSIONS
- storage — local-only token + last-import status.
- activeTab — read the currently active MyScoreIQ tab when you click Import.
- host_permissions: member.myscoreiq.com, disputeiq.org. No other site is accessed.

HOMEPAGE
https://disputeiq.org/connector

SUPPORT
support@disputeiq.org

LEGAL
DisputeIQ is a self-directed software platform that helps you analyze credit-report data and prepare dispute packets. DisputeIQ is not a credit-repair agency, law firm, or credit bureau. We operate under your existing rights as a consumer under the Fair Credit Reporting Act (FCRA, 15 U.S.C. §1681 et seq.).
```

---

## 2. Category & tags

- **Category**: Productivity
- **Language**: English (United States)
- **Audience**: Adults 18+ (financial product). Confirm the "intended audience" question at upload time.

---

## 3. Visual assets needed

### Icon

Already shipped in `extension/icons/`:
- `icon-128.png` (128 × 128) — Chrome Web Store uses this as the listing thumbnail.
- `icon-48.png`, `icon-16.png` — used by Chrome elsewhere.

Source: `extension/icons/icon-source.svg` (regenerate via `npm run extension:icons`).

### Screenshots (1280 × 800 PNG, JPEG, or sRGB)

The Web Store requires **at least 1 and up to 5** screenshots. Recommended:

1. **Hero — `/dashboard/get-report` showing the Connector card as the headline.**
   - Capture at 1280 × 800. Include the "Recommended · One-click import" eyebrow + the green "Best" pill.
   - File: `extension/screenshots/01-dashboard-card.png`

2. **Pairing modal — code displayed.**
   - Capture immediately after clicking "Generate pairing code" — the 6-letter display code is visible plus the countdown.
   - File: `extension/screenshots/02-pairing-code.png`

3. **Extension popup — paired + ready.**
   - Open the extension popup; show the "Connected as you@email.com" state with the "Import MyScoreIQ Report" button.
   - File: `extension/screenshots/03-popup-connected.png`

4. **Mid-import — "Importing…" state on the popup.**
   - Optional. Captures momentum.
   - File: `extension/screenshots/04-popup-importing.png`

5. **Result on `/dashboard/get-report?imported=…`** — your premium 5-step results screen with stats.
   - File: `extension/screenshots/05-results.png`

### Promotional tile (optional, but boosts discoverability)

- **Small promo tile**: 440 × 280 PNG.
- **Marquee promo tile**: 1400 × 560 PNG (only used if Google features us).
- File names: `extension/screenshots/promo-440x280.png`, `promo-1400x560.png`.

> All five screenshots can be taken with a real signed-in account on
> production. Use 1× pixel density (no Retina scaling) so the
> dimensions match exactly.

---

## 4. Distribution

- **Visibility**: Public.
- **Distribution regions**: All regions where Chrome is available.
- **Pricing**: Free.
- **Single purpose declaration**: "Send a copy of the user's MyScoreIQ tri-merge credit-report JSON to their DisputeIQ workspace, on user click, with no password handling."

---

## 5. Privacy practices declaration

Google's privacy questionnaire — answer like this:

| Question | Answer |
|---|---|
| Does the extension collect or use user data? | **Yes.** |
| What data is collected? | Personally identifiable info (the user's email, surfaced after pairing); financial info (the credit-report payload at the moment of import — sent to DisputeIQ servers and not retained by the extension). |
| What's the data used for? | Sole purpose stated in the listing: enabling one-click import into DisputeIQ. |
| Is data sold to third parties? | **No.** |
| Is data used or transferred for purposes unrelated to the item's core functionality? | **No.** |
| Is data used or transferred to determine creditworthiness or for lending purposes? | **No.** (DisputeIQ is a self-help dispute tool; we don't lend.) |
| Privacy policy URL | `https://disputeiq.org/extension-privacy` |

---

## 6. Permission justifications

When asked to justify each permission, paste these:

- **storage** — "Used to persist the user's pairing-derived bearer token and the timestamp + outcome of the most recent import in chrome.storage.local. No data leaves the user's device through this permission."
- **activeTab** — "Used by the popup's Import button to read the rendered JSON of the user's active MyScoreIQ tab. No background tabs are accessed."
- **host_permissions: https://member.myscoreiq.com/\*** — "We read the user's authenticated MyScoreIQ credit-report JSON to forward it to DisputeIQ at the user's request. We do not read any other page on this domain."
- **host_permissions: https://disputeiq.org/\*, https://www.disputeiq.org/\*** — "The extension's API calls (pairing, status, import) target DisputeIQ's own backend. CORS is enforced server-side."

If asked specifically about remote code: **No remote code is loaded.** The service worker, content script, and popup are all bundled at build time and shipped in the package.

---

## 7. Submission checklist

Pre-submission:
- [ ] `extension/manifest.json` version bumped if shipping a new build.
- [ ] `npm run extension:icons` re-run if the brand changed.
- [ ] `npm run extension:zip` produced a fresh `extension/dist/disputeiq-extension.zip`.
- [ ] Open the zip locally and verify it contains: `manifest.json`, `background.js`, `contentScript.js`, `popup.js`, `popup.html`, `icons/`.
- [ ] Test the unpacked build end-to-end on a real account (pair → import → success).
- [ ] `https://disputeiq.org/extension-privacy` is reachable (test in incognito).
- [ ] `https://disputeiq.org/connector` is reachable.
- [ ] Five 1280 × 800 screenshots in `extension/screenshots/` (or fewer — minimum 1).

In the Chrome Web Store Developer Dashboard:
- [ ] Pay the one-time $5 developer registration fee (if not already done).
- [ ] Upload the `disputeiq-extension.zip`.
- [ ] Paste in: name, short description, detailed description (Section 1).
- [ ] Upload icons: 128 × 128 (already in zip — Web Store re-pulls automatically).
- [ ] Upload screenshots.
- [ ] Set category, language, audience.
- [ ] Privacy practices: paste answers from Section 5.
- [ ] Permission justifications: paste answers from Section 6.
- [ ] Privacy policy URL: `https://disputeiq.org/extension-privacy`.
- [ ] Homepage URL: `https://disputeiq.org/connector`.
- [ ] Support email: `support@disputeiq.org`.
- [ ] Single purpose: paste from Section 4.
- [ ] Click **Submit for review**.

Post-submission:
- [ ] Save the dashboard URL of the listing.
- [ ] Note the review SLA (Google says 1–2 business days, can be longer for finance category).
- [ ] When approved: copy the listing URL (e.g. `https://chromewebstore.google.com/detail/<EXTENSION_ID>`) and set `NEXT_PUBLIC_CHROME_WEB_STORE_URL` on Vercel Production. Both `/connector` and `ExtensionPairingCard` will swap to the Web Store CTA on the next deploy.
- [ ] Test the Web Store install once in incognito.

---

## 8. Versioning

- Source of truth for the version number is `extension/manifest.json`.
- When bumping, also rename `public/downloads/disputeiq-connector-v<version>.zip` and update the URL in `app/(marketing)/connector/page.tsx` + `components/dashboard/ExtensionPairingCard.tsx` (search for `disputeiq-connector-v0.1.0.zip`).
- After Web Store approval, the version flow becomes: bump manifest → `npm run extension:zip` → upload zip in Web Store dashboard → submit for re-review. The static `.zip` URL stops being load-bearing once the Web Store URL is set.
