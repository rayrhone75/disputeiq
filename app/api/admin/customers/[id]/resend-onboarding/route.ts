import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { clerkUserIdFor, gateAdminRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/resend-onboarding
//
// Generates a one-time Clerk magic-link for the customer that lands on
// /dashboard/get-report (the onboarding flow). We don't have email
// infrastructure today, so the admin copies the URL and sends it
// through their existing support channel.

export const dynamic = "force-dynamic";

const TTL_SECONDS = 60 * 60 * 24; // 24h

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
      {
        ok: false,
        code: "NO_CLERK_USER",
        message: "Customer has no Clerk identity on file.",
      },
      { status: 200 },
    );
  }

  let url: string | null = null;
  try {
    const c = await clerkClient();
    const token = await c.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: TTL_SECONDS,
    });
    // Clerk's URL points to a signed-in destination; we tack the
    // get-report path on as redirect_url so they land on the import
    // flow, not the bare dashboard.
    const u = new URL(token.url);
    u.searchParams.set("redirect_url", "/dashboard/get-report?welcome=1");
    url = u.toString();
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

  await fetchMutation(
    api.adminCustomers.logAdminAction,
    {
      customerId,
      action: "ADMIN_ONBOARDING_LINK_ISSUED",
      metadataJson: { ttlSeconds: TTL_SECONDS },
    },
    { token: convexToken },
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    onboardingLink: url,
    expiresInSeconds: TTL_SECONDS,
  });
}
