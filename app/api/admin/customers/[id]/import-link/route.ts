import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { clerkUserIdFor, gateAdminRoute } from "@/lib/admin/api-helpers";

// POST /api/admin/customers/:id/import-link
//
// "Import report for customer" — admin can generate a customer-specific
// magic-link that lands the customer directly on /dashboard/get-report.
// Same primitive as resend-onboarding, but framed as an import action
// in the audit log so support can distinguish "I asked them to onboard"
// from "I asked them to re-import a fresh report".

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
    const u = new URL(token.url);
    u.searchParams.set("redirect_url", "/dashboard/get-report");
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
      action: "ADMIN_IMPORT_LINK_ISSUED",
      metadataJson: { ttlSeconds: TTL_SECONDS },
    },
    { token: convexToken },
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    importLink: url,
    expiresInSeconds: TTL_SECONDS,
  });
}
