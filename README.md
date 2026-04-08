# DisputeIQ

DIY credit workflow platform — report ingestion, factual audit, dispute case workflow, server-side letter prep, payment, certified mailing, and tracking. Compliance-first.

## What it is
A software and workflow tool that helps consumers organize, prepare, and track their own credit dispute actions. Not a law firm. Not a credit-repair guarantee.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL · Zod · Square · LetterStream · MyFreeScoreNow adapter

## Quick start
```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

## Layout
- `app/` — routes (marketing, auth, dashboard, admin, api)
- `lib/` — services, adapters, compliance, audit, encryption
- `prisma/` — schema, migrations, seed
- `DEPLOYMENT.md` — production checklist & acceptance criteria

## Compliance rules baked in
- All state-changing routes require explicit user confirmation.
- Letters render as server-side previews with watermark; no raw PDF download pre-payment.
- Every action writes to an immutable audit log.
- 605B requires identity theft report + ID attachments.
- Shadow Strike (secondary bureau freeze assistance) is user-initiated and user-confirmed.
- CFPB packets are user-submitted; the platform never submits on the user's behalf.

## Next steps
1. Wire real auth (Auth.js / Clerk).
2. Implement real PDF parser & OCR pipeline.
3. Replace mock Square/LetterStream/MFSN adapters with live SDKs.
4. Add Playwright E2E covering the full dispute → pay → mail flow.
