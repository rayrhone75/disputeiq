import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { signBookmarkletToken } from "@/lib/auth/bookmarklet-token";

// Client-triggered token issuance for the bookmarklet card.
//
// Token signing depends on `INTERNAL_SERVICE_SECRET`, which only exists
// server-side. Doing it during the page's server render previously
// produced a Vercel server-component error if anything in the auth chain
// blipped. Moving it to a Clerk-authed API route keeps the page render
// dumb — the BookmarkletCard fetches `{ token }` from here on mount.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  try {
    const token = signBookmarkletToken(userId);
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "SIGN_FAILED",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }
}
