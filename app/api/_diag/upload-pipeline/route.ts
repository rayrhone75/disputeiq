import { NextResponse } from "next/server";
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
//   - Env-var presence (ENCRYPTION_KEY / INTERNAL_SERVICE_SECRET /
//     storage creds) without leaking values.
//   - pdf-parse load test (does the dynamic require resolve at runtime
//     on this Vercel build, or does it fail because the function
//     bundle stripped the vendored pdfjs-dist?).
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

async function pdfParseLoadTest(): Promise<{
  ok: boolean;
  importPath: string;
  error?: string;
}> {
  // Mirrors the exact import lib/report-parser.ts uses. A failure here
  // tells us the serverExternalPackages config or the vendored pdfjs
  // worker still isn't resolving on Vercel — i.e. the production fix
  // isn't deployed yet, or the build externalization regressed.
  const importPath = "pdf-parse/lib/pdf-parse.js";
  try {
    const mod: unknown = await import(importPath as unknown as string);
    const fn =
      (mod as { default?: unknown }).default ?? (mod as unknown as () => unknown);
    if (typeof fn !== "function") {
      return {
        ok: false,
        importPath,
        error: `Imported module is not callable (typeof=${typeof fn}).`,
      };
    }
    return { ok: true, importPath };
  } catch (err) {
    return {
      ok: false,
      importPath,
      error: (err as Error).message?.slice(0, 400) ?? String(err),
    };
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const env = {
    ENCRYPTION_KEY: {
      present: (process.env.ENCRYPTION_KEY ?? "").length > 0,
      length: (process.env.ENCRYPTION_KEY ?? "").length,
      meetsMinimum: (process.env.ENCRYPTION_KEY ?? "").length >= 32,
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

  const pdfParse = await pdfParseLoadTest();

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
    pdfParse,
    convex,
    nodeVersion: process.version,
    platform: process.platform,
  });
}
