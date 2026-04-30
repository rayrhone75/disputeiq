import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { clerkUserIdFor, gateAdminRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/password-reset
//
// We can't initiate a Clerk-side password reset directly via the
// backend SDK without involving the user's email flow. The practical,
// safe admin action is two-fold:
//   1. Revoke every active session for the customer (forces a fresh
//      sign-in so any stolen session token stops working).
//   2. Generate a one-time Clerk magic-link the admin can copy and
//      email/SMS to the customer. When they click it they land
//      signed-in on /dashboard and can use Clerk's "Change password"
//      flow from the user-button menu.
//
// We never expose any password material. The magic-link is a sign-in
// token (single use, ~1h TTL) — not the customer's password.

export const dynamic = "force-dynamic";

const TTL_SECONDS = 60 * 60; // 1 hour

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await gateAdminRoute(id);
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { convexToken, customerId } = gate.ctx;

  const clerkUserId = await clerkUserIdFor(gate.ctx);
  if (!clerkUserId) {
    return NextResponse.json(
      { ok: false, code: "NO_CLERK_USER", message: "Customer has no Clerk identity on file." },
      { status: 200 },
    );
  }

  let revokedCount = 0;
  let url: string | null = null;
  let warning: string | null = null;

  try {
    const c = await clerkClient();
    // Best-effort session revocation. If a single session fails we
    // still try the rest and continue.
    try {
      const sessionList = await c.sessions.getSessionList({
        userId: clerkUserId,
      });
      const sessions = "data" in sessionList ? sessionList.data : sessionList;
      const active = sessions.filter(
        (s) => s.status === "active" || s.status === "pending",
      );
      for (const s of active) {
        try {
          await c.sessions.revokeSession(s.id);
          revokedCount += 1;
        } catch {
          /* ignore individual revoke failure */
        }
      }
    } catch (err) {
      warning = `Session revoke failed: ${(err as Error).message}`;
    }

    try {
      const token = await c.signInTokens.createSignInToken({
        userId: clerkUserId,
        expiresInSeconds: TTL_SECONDS,
      });
      url = token.url;
    } catch (err) {
      // If sign-in tokens aren't enabled on the Clerk instance, surface
      // a clear error so the admin can fall back to manually triggering
      // the reset from Clerk Dashboard.
      warning = `Magic-link creation failed: ${(err as Error).message}`;
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "CLERK_ERROR",
        message: (err as Error).message,
      },
      { status: 200 },
    );
  }

  // Audit the action.
  await fetchMutation(
    api.adminCustomers.logAdminAction,
    {
      customerId,
      action: "ADMIN_PASSWORD_RESET_TRIGGERED",
      metadataJson: {
        revokedSessions: revokedCount,
        magicLinkIssued: !!url,
        warning,
      },
    },
    { token: convexToken },
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    revokedSessions: revokedCount,
    magicLink: url,
    warning,
  });
}
