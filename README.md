# DisputeIQ

DIY credit workflow platform — report ingestion, factual audit, dispute case workflow, server-side letter prep, payment, certified mailing, and tracking. Compliance-first.

## What it is
A software and workflow tool that helps consumers organize, prepare, and track their own credit dispute actions. Not a law firm. Not a credit-repair guarantee.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Convex (database + functions) · Clerk (auth) · Zod · Square · LetterStream · MyScoreIQ adapter

## Quick start
```bash
cp .env.example .env
npm install
npx convex dev          # in a separate terminal — provisions the dev deployment
npm run dev
```

## Layout
- `app/` — routes (marketing, auth, dashboard, admin, api)
- `lib/` — services, adapters, compliance, audit, encryption
- `convex/` — schema, queries, mutations, generated client
- `DEPLOYMENT.md` — production checklist & acceptance criteria

## Compliance rules baked in
- All state-changing routes require explicit user confirmation.
- Letters render as server-side previews with watermark; no raw PDF download pre-payment.
- Every action writes to an immutable audit log.
- 605B requires identity theft report + ID attachments.
- Shadow Strike (secondary bureau freeze assistance) is user-initiated and user-confirmed.
- CFPB packets are user-submitted; the platform never submits on the user's behalf.

## Next steps
1. Implement real PDF parser & OCR pipeline.
2. Replace mock Square/LetterStream adapters with live SDKs.
3. Add Playwright E2E covering the full dispute → pay → mail flow.
