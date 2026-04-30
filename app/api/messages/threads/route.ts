import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// GET  /api/messages/threads → list mine (customer) — admin uses
//                              /api/admin/customers/[id]/threads
// POST /api/messages/threads → create thread
//   Customer body: { subject?, body }
//   Admin body:    { customerId, subject?, body }

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ ok: false, code: "NO_CONVEX_TOKEN", threads: [] });
    }
    const threads = await fetchQuery(
      api.messages.listMyThreads,
      {},
      { token },
    );
    return NextResponse.json({ ok: true, threads });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "LOAD_FAILED",
        message: (err as Error).message,
        threads: [],
      },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    body?: unknown;
    subject?: unknown;
    customerId?: unknown;
  };
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "body is required" },
      { status: 400 },
    );
  }
  try {
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "NO_CONVEX_TOKEN" },
        { status: 200 },
      );
    }
    const args: {
      body: string;
      subject?: string;
      customerId?: Id<"users">;
    } = { body: body.body };
    if (typeof body.subject === "string" && body.subject.trim()) {
      args.subject = body.subject;
    }
    if (typeof body.customerId === "string" && body.customerId) {
      args.customerId = body.customerId as unknown as Id<"users">;
    }
    const r = await fetchMutation(api.messages.createThread, args, { token });
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "ACTION_FAILED",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }
}
