// Shared helpers for /api/admin/customers/* route handlers.
//
// Every Phase-1 admin action follows the same shape:
//   1. Confirm the caller has a Clerk session and an OWNER/ADMIN/SUPPORT
//      role (we re-check here even though middleware also gates /admin
//      because API routes don't pass through the same matcher group).
//   2. Resolve the target Convex user id from the URL parameter.
//   3. Run the action via fetchMutation/fetchQuery with the caller's
//      Convex JWT.
//   4. Return JSON, never throw out of the route.

import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireRole } from "@/lib/auth";

const ALLOWED_ROLES = ["OWNER", "ADMIN", "SUPPORT"] as const;

export type AdminApiCtx = {
  /** Clerk Convex JWT — pass to fetchMutation/fetchQuery as `token`. */
  convexToken: string;
  /** Convex user-id of the customer the action is being performed on. */
  customerId: Id<"users">;
};

export type AdminApiResult<T> =
  | { ok: true; ctx: AdminApiCtx; data: T }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Auth + role check + Convex JWT mint, with a uniform error response.
 * Use at the top of every admin route handler:
 *
 *   const gate = await gateAdminRoute(rawId);
 *   if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
 *   const { convexToken, customerId } = gate.ctx;
 */
export async function gateAdminRoute(
  rawId: string,
): Promise<
  | { ok: true; ctx: AdminApiCtx }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, code: "UNAUTHENTICATED" },
    };
  }
  const me = await requireRole(ALLOWED_ROLES as unknown as Array<
    "OWNER" | "ADMIN" | "SUPPORT" | "USER"
  >).catch(() => null);
  if (!me) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, code: "FORBIDDEN" },
    };
  }
  if (!rawId || typeof rawId !== "string") {
    return {
      ok: false,
      status: 400,
      body: { ok: false, code: "BAD_ID" },
    };
  }
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return {
      ok: false,
      status: 500,
      body: { ok: false, code: "NO_CONVEX_TOKEN" },
    };
  }
  return {
    ok: true,
    ctx: {
      convexToken,
      customerId: rawId as unknown as Id<"users">,
    },
  };
}

/**
 * Look up the Clerk subject for a Convex user id. Used by the actions
 * that need to call Clerk's backend SDK against the customer (magic
 * link, session revocation, etc.).
 */
export async function clerkUserIdFor(
  ctx: AdminApiCtx,
): Promise<string | null> {
  // The cheapest way to get the clerkUserId is via the existing
  // customerConsole query — it returns the full user doc with
  // clerkUserId on it. We don't need any other field.
  const console = await fetchQuery(
    api.admin.customerConsole,
    { userId: ctx.customerId },
    { token: ctx.convexToken },
  ).catch(() => null);
  return console?.user?.clerkUserId ?? null;
}
