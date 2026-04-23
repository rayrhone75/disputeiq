import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Fast customer lookup for the support workspace.
// Matches on email substring, exact user id, or the last 8 chars of an
// import id so support can paste any identifier from a ticket.
export async function GET(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const includeArchived = url.searchParams.get("archived") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25"), 1), 100);

  if (!q) {
    const recent = await prisma.user.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        archivedAt: true,
        createdAt: true,
        _count: {
          select: { creditImports: true, disputes: true, supportNotes: true },
        },
      },
    });
    return NextResponse.json({ users: recent });
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        includeArchived ? {} : { archivedAt: null },
        {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { id: q },
            { creditImports: { some: { id: { contains: q } } } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      role: true,
      archivedAt: true,
      createdAt: true,
      _count: {
        select: { creditImports: true, disputes: true, supportNotes: true },
      },
    },
  });
  return NextResponse.json({ users });
}
