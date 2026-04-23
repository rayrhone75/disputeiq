import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// Customer-scoped import detail. Only returns data for imports that belong
// to the authenticated user.
export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await ctx.params;
  const imp = await prisma.creditReportImport.findFirst({
    where: { id, userId: user.id },
    include: {
      normalized: true,
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
  });
  if (!imp) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ import: imp });
}
