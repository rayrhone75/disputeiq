import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  APP_BASE_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().min(32),
  SQUARE_ACCESS_TOKEN: z.string().optional(),
  SQUARE_LOCATION_ID: z.string().optional(),
  SQUARE_WEBHOOK_SIGNATURE_KEY: z.string().optional(),
  LETTERSTREAM_API_KEY: z.string().optional(),
  LETTERSTREAM_API_SECRET: z.string().optional(),
  MFSN_API_KEY: z.string().optional(),
  MFSN_AFFILIATE_LINK: z.string().optional(),
  MFSN_CALLBACK_URL: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  OCR_API_KEY: z.string().optional(),
});

export const env =
  process.env.SKIP_ENV_VALIDATION === "1"
    ? (process.env as any)
    : schema.parse(process.env);
