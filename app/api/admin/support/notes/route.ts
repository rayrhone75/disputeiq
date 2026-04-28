import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { requireRole } from "@/lib/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const CategoryZ = z
  .enum(["general", "billing", "report", "escalation"])
  .default("general");

const CreateZ = z.object({
  userId: z.string().min(1),
  body: z.string().min(1).max(8000),
  category: CategoryZ.optional(),
  pinned: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const notes = await fetchQuery(
    api.support.listNotes,
    { userId: userId as Id<"users"> },
    { token },
  );
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "ADMIN", "SUPPORT"]).catch(() => null);
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = CreateZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const note = await fetchMutation(
      api.support.createNote,
      {
        userId: parsed.data.userId as Id<"users">,
        body: parsed.data.body,
        category: parsed.data.category,
        pinned: parsed.data.pinned,
      },
      { token },
    );
    return NextResponse.json({ note });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("USER_NOT_FOUND")) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
