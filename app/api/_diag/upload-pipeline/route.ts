import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// GET /api/_diag/upload-pipeline
//
// Admin-only diagnostic surface for the credit-report upload pipeline.
// When a customer says "still not able to upload" we have no production
// log surface that tells us which knob is wrong — so this endpoint
// reports the exact set of preconditions in one round-trip:
//
//   - Env-var presence (ENCRYPTION_KEY / MISTRAL_API_KEY /
//     INTERNAL_SERVICE_SECRET / storage creds) without leaking values.
//   - Mistral health probe (behind ?mistralPing=1): does the chat
//     completion endpoint accept our key and return JSON?
//   - Convex connectivity (does latestForCurrentUser respond).
//   - Whether the calling user has a stuck import that would pin them
//     on the EmptyResultsRecovery card.
//
// Pure read-only — never mutates anything. Admin-gated via Clerk
// publicMetadata.role check (same pattern as the other admin routes
// in this repo).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const u = await currentUser();
  if (!u) return false;
  const role =
    ((u.publicMetadata as { role?: string } | undefined)?.role as
      | string
      | undefined) ??
    ((u.privateMetadata as { role?: string } | undefined)?.role as
      | string
      | undefined);
  return role === "OWNER" || role === "ADMIN";
}

async function mistralPing(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return { ok: false, error: "MISTRAL_API_KEY not set" };
  const start = Date.now();
  try {
    // Cheapest possible call: 1-token completion that just verifies auth.
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.MISTRAL_PARALEGAL_MODEL ?? "mistral-large-latest",
        max_tokens: 1,
        temperature: 0,
        messages: [{ role: "user", content: "ok" }],
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        latencyMs,
        error: `${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: (err as Error).message?.slice(0, 400) ?? String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const env = {
    ENCRYPTION_KEY: {
      present: (process.env.ENCRYPTION_KEY ?? "").length > 0,
      length: (process.env.ENCRYPTION_KEY ?? "").length,
      meetsMinimum: (process.env.ENCRYPTION_KEY ?? "").length >= 32,
    },
    MISTRAL_API_KEY: {
      present: (process.env.MISTRAL_API_KEY ?? "").length > 0,
      length: (process.env.MISTRAL_API_KEY ?? "").length,
    },
    INTERNAL_SERVICE_SECRET: {
      present: (process.env.INTERNAL_SERVICE_SECRET ?? "").length > 0,
    },
    NEXT_PUBLIC_CONVEX_URL: {
      present: !!process.env.NEXT_PUBLIC_CONVEX_URL,
      value: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
    },
    STORAGE: {
      bucket: !!process.env.STORAGE_BUCKET,
      endpoint: !!process.env.STORAGE_ENDPOINT,
      accessKey: !!process.env.STORAGE_ACCESS_KEY,
      secretKey: !!process.env.STORAGE_SECRET_KEY,
    },
  };

  const url = new URL(req.url);
  const mistral = url.searchParams.get("mistralPing") === "1"
    ? await mistralPing()
    : { ok: undefined, skipped: true };

  // Best-effort Convex check — calls latestForCurrentUser as the calling
  // (admin) user. If Convex cloud isn't reachable or schema is out of
  // sync we'll see the failure here.
  let convex: {
    ok: boolean;
    latestImport: {
      id: string;
      status: string;
      provider: string;
      createdAt: number;
      ageMinutes: number;
    } | null;
    error?: string;
  } = { ok: false, latestImport: null };
  try {
    const { getToken } = await auth();
    const token = (await getToken({ template: "convex" })) ?? undefined;
    const latest = await fetchQuery(
      api.creditImports.latestForCurrentUser,
      {},
      { token },
    );
    if (latest) {
      convex = {
        ok: true,
        latestImport: {
          id: latest._id as unknown as string,
          status: latest.status,
          provider: latest.provider,
          createdAt: latest.createdAt,
          ageMinutes: Math.round((Date.now() - latest.createdAt) / 60000),
        },
      };
    } else {
      convex = { ok: true, latestImport: null };
    }
  } catch (err) {
    convex = {
      ok: false,
      latestImport: null,
      error: (err as Error).message?.slice(0, 400) ?? String(err),
    };
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env,
    mistral,
    convex,
    nodeVersion: process.version,
    platform: process.platform,
  });
}
