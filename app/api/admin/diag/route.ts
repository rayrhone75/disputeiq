import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Admin self-serve deploy diagnostic.
//
// Returns PRESENCE BOOLEANS ONLY for the env vars the credit-import
// pipeline depends on — never the values themselves. The #1 cause of
// "uploads don't work on the live site" is a key that exists in local
// `.env.local` (which Vercel never reads) but was never added to the
// Vercel project env. This endpoint makes that diagnosable in one click
// instead of guessing from a generic "needs_review" wallpaper.
//
// Auth: reuses the same admin gate as the rest of /api/admin — the
// `adminList` Convex query throws "FORBIDDEN" for non-admin identities.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function present(name: string, minLen = 1): boolean {
  return (process.env[name] ?? "").length >= minLen;
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const token = await getToken({ template: "convex" });

  // Gate on admin: this throws "FORBIDDEN" for non-admins, same as the
  // other admin routes. We only need it to authorize — discard the rows.
  try {
    await fetchQuery(
      api.creditImports.adminList,
      { limit: 1, offset: 0 },
      { token: token ?? undefined },
    );
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }

  const env = {
    OPENAI_API_KEY: present("OPENAI_API_KEY"),
    MISTRAL_API_KEY: present("MISTRAL_API_KEY"),
    // encryption.ts requires >= 32 chars — report the *usable* state,
    // not just "set", so a too-short key is caught here too.
    ENCRYPTION_KEY: present("ENCRYPTION_KEY", 32),
    NEXT_PUBLIC_CONVEX_URL: present("NEXT_PUBLIC_CONVEX_URL"),
    CONVEX_DEPLOYMENT: present("CONVEX_DEPLOYMENT"),
    INTERNAL_SERVICE_SECRET: present("INTERNAL_SERVICE_SECRET"),
  };

  // Uploads of PDF/HTML/TXT need all three of these; JSON/extension
  // imports need only ENCRYPTION_KEY + Convex.
  const uploadReady =
    env.OPENAI_API_KEY && env.MISTRAL_API_KEY && env.ENCRYPTION_KEY;
  const missing = Object.entries(env)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return NextResponse.json({
    ok: true,
    uploadReady,
    missing,
    env,
    vercelEnv: process.env.VERCEL_ENV ?? "local",
  });
}
