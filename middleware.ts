import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Combined middleware: subdomain routing + Auth.js route protection.
// - disputeiq.org / www.disputeiq.org   -> marketing
// - app.disputeiq.org                   -> dashboard + api
// - admin.disputeiq.org                 -> rewrites to /admin/*
// - api.disputeiq.org                   -> rewrites to /api/*
//
// Auth gate: /dashboard/** and /admin/** require a session.
// /admin/** additionally requires OWNER, ADMIN, or SUPPORT role.
export default auth((req) => {
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  const url = req.nextUrl;
  const path = url.pathname;
  const session = req.auth as any;

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
  const needsSession = path.startsWith("/dashboard") || path.startsWith("/admin");
  if (needsSession && !session?.user) {
    const signin = req.nextUrl.clone();
    signin.pathname = "/sign-in";
    signin.searchParams.set("next", path);
    return NextResponse.redirect(signin);
  }

  if (path.startsWith("/admin")) {
    const role = session?.user?.role;
    if (!role || !["OWNER", "ADMIN", "SUPPORT"].includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
