import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Combined middleware: subdomain routing + Clerk auth gates.
// - disputeiq.org / www.disputeiq.org   -> marketing
// - app.disputeiq.org                   -> dashboard + api
// - admin.disputeiq.org                 -> rewrites to /admin/*
// - api.disputeiq.org                   -> rewrites to /api/*
//
// Auth gate: /dashboard/** and /admin/** require a Clerk session.
// /admin/** additionally requires role OWNER | ADMIN | SUPPORT — read from
// Clerk's sessionClaims.publicMetadata.role. Set that per-user in the
// Clerk dashboard (User → Public metadata → `{"role":"OWNER"}`) or via API.

const isProtected = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"]);
const isAdminOnly = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  const url = req.nextUrl;
  const path = url.pathname;

  // --- Subdomain routing -------------------------------------------------
  if (host.endsWith("disputeiq.org")) {
    const isMarketing = host === "disputeiq.org" || host === "www.disputeiq.org";
    const isApp = host === "app.disputeiq.org";
    const isAdmin = host === "admin.disputeiq.org";
    const isApi = host === "api.disputeiq.org";

    if (isMarketing && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
      url.host = "app.disputeiq.org";
      return NextResponse.redirect(url, 308);
    }
    if (isApp) {
      const marketingOnly = ["/pricing", "/trust-center", "/how-it-works"];
      if (marketingOnly.some((p) => path === p || path.startsWith(p + "/"))) {
        url.host = "disputeiq.org";
        return NextResponse.redirect(url, 308);
      }
    }
    if (isAdmin && !path.startsWith("/admin")) {
      url.pathname = "/admin" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    if (isApi && !path.startsWith("/api")) {
      url.pathname = "/api" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
  }

  // --- Auth gates --------------------------------------------------------
  if (isProtected(req)) {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      const signin = req.nextUrl.clone();
      signin.pathname = "/sign-in";
      signin.searchParams.set("redirect_url", path);
      return NextResponse.redirect(signin);
    }
    if (isAdminOnly(req)) {
      const pub =
        (sessionClaims?.publicMetadata as { role?: string } | undefined) ??
        (sessionClaims?.metadata as { role?: string } | undefined);
      const role = pub?.role;
      if (!role || !["OWNER", "ADMIN", "SUPPORT"].includes(role)) {
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
