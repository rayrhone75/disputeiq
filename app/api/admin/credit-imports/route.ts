import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CreateImportZ } from "@/lib/credit-import/schemas";
import { createImport } from "@/lib/credit-import/runner";

const VALID_STATUSES = new Set([
  "PENDING",
  "FETCHED",
  "VALIDATED",
  "NORMALIZED",
  "FAILED",
  "ARCHIVED",
] as const);
const VALID_PROVIDERS = new Set([
  "IDENTITYIQ",
  "MYSCOREIQ",
  "MYFREESCORENOW",
  "MANUAL",
] as const);

type ImportStatus = typeof VALID_STATUSES extends Set<infer T> ? T : never;
type ImportProvider = typeof VALID_PROVIDERS extends Set<infer T> ? T : never;

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const rawProvider = url.searchParams.get("provider") ?? undefined;
  const rawUserId = url.searchParams.get("userId") ?? undefined;
  const rawEmail = url.searchParams.get("email") ?? undefined;
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  const statusArg =
    rawStatus && (VALID_STATUSES as Set<string>).has(rawStatus)
      ? (rawStatus as ImportStatus)
      : undefined;
  const providerArg =
    rawProvider && (VALID_PROVIDERS as Set<string>).has(rawProvider)
      ? (rawProvider as ImportProvider)
      : undefined;

  try {
    const result = await fetchQuery(
      api.creditImports.adminList,
      {
        status: statusArg,
        provider: providerArg,
        userId: rawUserId ? (rawUserId as Id<"users">) : undefined,
        emailContains: rawEmail || undefined,
        limit,
        offset,
      },
      { token: token ?? undefined },
    );
    return NextResponse.json({
      imports: result.imports,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (err) {
    if ((err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const token = await getToken({ template: "convex" });

  const parsed = CreateImportZ.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const imp = await createImport(
      { token },
      {
        userId: parsed.data.userId as Id<"users">,
        provider: parsed.data.provider,
        providerRef: parsed.data.providerRef,
        sourceUrl: parsed.data.sourceUrl,
      },
    );
    return NextResponse.json({ import: imp });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (msg === "USER_NOT_FOUND")
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json(
      { error: "INTERNAL", message: msg },
      { status: 500 },
    );
  }
}

