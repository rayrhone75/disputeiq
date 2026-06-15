# One-click credit-report import — recommendation & vendor outreach

## Recommendation (buy, don't build)
Stop relying on browser-extension/scraping of MyScoreIQ/IdentityIQ/SmartCredit — that's exactly
why one-click keeps breaking (brittle, breaks on 2-factor login, against provider terms). Instead
integrate an **official, consumer-authorized credit-report API**.

**Top pick: CRS Credit API — https://crscreditapi.com**
- Soft pull (no score impact), **tri-bureau** (Experian/Equifax/TransUnion), report as **JSON + PDF**.
- Ships an **embeddable, brandable consumer-enrollment widget** → true one-click; we don't build identity verification.
- **They are the licensed CRA** and run the bureau vetting/compliance, so **DisputeIQ does not become a CRA**.
- Legal basis: FCRA "written instructions of the consumer" permissible purpose (consumer pulling their own report).

**Runner-up: Array (https://array.com)** — same idea, mature, but bank/fintech-oriented and likely heavier/enterprise onboarding. Good as a fallback or negotiating leverage.

**Stopgap: IDIQ B2B** — explicitly welcomes credit-repair partners, but it's closer to the monitoring-login model we're trying to leave.

> Open risk to clear up front: CRS does not advertise credit-repair as a vertical. Confirm it's an approved use case **before** committing.

---

## Outreach email (copy/paste to CRS sales — "Talk with an expert" / Contact sales)

> **Subject:** Credit-repair SaaS — consumer-authorized tri-bureau API + enrollment widget
>
> Hi CRS team,
>
> I run DisputeIQ, a credit-repair / dispute SaaS. I want to give my customers a one-click way to
> authorize and import **their own** 3-bureau credit report into my app, replacing the brittle
> "log into IdentityIQ/SmartCredit and scrape it" approach.
>
> Before we commit, can you confirm the following?
>
> 1. **Use case approval:** Is a credit-repair / dispute-management company an **approved use case** for your API and eCredit Monitoring widget?
> 2. **Data & format:** Tri-bureau report returned as **JSON** (and PDF), including tradelines, inquiries, collections, public records, and scores?
> 3. **Soft pull:** Is the consumer self-pull a **soft inquiry** (no score impact)?
> 4. **Enrollment widget:** Can we embed your **brandable consumer-enrollment widget** so the consumer verifies identity once and the report flows to us — i.e., we don't build our own identity verification?
> 5. **Compliance:** You are the **licensed CRA / reseller** and handle bureau vetting and subscriber codes, correct? What does the vetting process and timeline look like for us?
> 6. **Pricing:** Per-enrollment / per-pull pricing, monthly minimums, and any setup fees?
> 7. **Integration:** Sandbox/test access, API docs, and typical time-to-live for a small SaaS?
>
> Happy to hop on a call. Thanks!
>
> — Ray, DisputeIQ

---

## How it slots into the existing code (after access — do NOT build before the answers above)
- New adapter `lib/credit-import/providers/crs.ts` mirroring the existing `vhParalegalToMyScoreIQ`
  adapter: CRS report JSON → normalized shape → reuse `createImport` / `captureRaw` /
  `runNormalization` in `lib/credit-import/runner.ts`.
- Embed the CRS widget in `app/dashboard/get-report` (alongside, then replacing, the extension card).
- **Reused unchanged:** Convex schema, `disputeViolations`, the lawyer pipeline, and the results UI.
- Manual upload + paste stay as the always-available fallback.
