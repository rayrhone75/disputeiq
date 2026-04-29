import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Single-domain Clerk auth gates.
// /dashboard/** and /admin/** require a Clerk session.
// /admin/** additionally requires role OWNER | ADMIN | SUPPORT.
//
// Role lookup precedence:
//   1. sessionClaims.publicMetadata.role  (fastest — requires Clerk session
//      token customization to surface publicMetadata as a claim)
//   2. sessionClaims.metadata.role        (alternate shape some templates use)
//   3. clerkClient.users.getUser(userId)  (fallback — one Backend API call)
//
// The Clerk Backend fallback means admins work without configuring the
// session token template. Set role per-user in the Clerk dashboard
// (User → Public metadata → `{"role":"ADMIN"}`) or via the API.

const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/import(.*)",
]);
const isAdminOnly = createRouteMatcher(["/admin(.*)"]);
const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "SUPPORT"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      const signin = req.nextUrl.clone();
      signin.pathname = "/sign-in";
      signin.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signin);
    }
    if (isAdminOnly(req)) {
      const claimRole =
        (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role ??
        (sessionClaims?.metadata as { role?: string } | undefined)?.role;

      let role = claimRole;
      if (!role) {
        try {
          const client = await clerkClient();
          const user = await client.users.getUser(userId);
          role =
            (user.publicMetadata as { role?: string } | undefined)?.role ??
            (user.privateMetadata as { role?: string } | undefined)?.role;
        } catch {
          // network/api blip — fall through, treat as unauthorized
        }
      }

      if (!role || !ADMIN_ROLES.has(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals + static files; run on everything else (incl. API).
    "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.[\\w]+$).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
