import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateImportZ } from "@/lib/credit-import/schemas";
import { createImport } from "@/lib/credit-import/runner";
import type { CreditImportStatus, CreditProvider, Prisma } from "@prisma/client";

const VALID_STATUSES = new Set<CreditImportStatus>([
  "PENDING",
  "FETCHED",
  "VALIDATED",
  "NORMALIZED",
  "FAILED",
  "ARCHIVED",
]);
const VALID_PROVIDERS = new Set<CreditProvider>([
  "IDENTITYIQ",
  "MYSCOREIQ",
  "MYFREESCORENOW",
  "MANUAL",
]);

export async function GET(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const rawProvider = url.searchParams.get("provider") ?? undefined;
  const rawUserId = url.searchParams.get("userId") ?? undefined;
  const rawEmail = url.searchParams.get("email") ?? undefined;
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  const where: Prisma.CreditReportImportWhereInput = {};
  if (rawStatus && VALID_STATUSES.has(rawStatus as CreditImportStatus)) {
    where.status = rawStatus as CreditImportStatus;
  }
  if (rawProvider && VALID_PROVIDERS.has(rawProvider as CreditProvider)) {
    where.provider = rawProvider as CreditProvider;
  }
  if (rawUserId) where.userId = rawUserId;
  if (rawEmail) {
    where.user = { email: { contains: rawEmail, mode: "insensitive" } };
  }

  const [imports, total] = await Promise.all([
    prisma.creditReportImport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: { select: { email: true } },
        _count: {
          select: {
            tradelines: true,
            inquiries: true,
            collections: true,
            publicRecords: true,
            disputeCandidates: true,
          },
        },
      },
    }),
    prisma.creditReportImport.count({ where }),
  ]);
  return NextResponse.json({ imports, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const parsed = CreateImportZ.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Verify target user exists — importing against a ghost user is a mistake.
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const imp = await createImport({
    userId: parsed.data.userId,
    provider: parsed.data.provider,
    providerRef: parsed.data.providerRef,
    sourceUrl: parsed.data.sourceUrl,
    actorUserId: user.id,
  });
  return NextResponse.json({ import: imp });
}
