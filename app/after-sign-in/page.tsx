// Post-sign-in dispatcher.
//
// Clerk's <SignIn> sends authenticated users here; we then route by role:
//   OWNER / ADMIN / SUPPORT  → /admin
//   USER (and everyone else) → /dashboard
//
// Server component so the redirect happens before any UI renders. Admins
// can still type /dashboard manually if they want the customer view.

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN", "SUPPORT"]);

export default async function AfterSignInPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const u = await currentUser();
  const role =
    (u?.publicMetadata as { role?: string } | undefined)?.role ??
    (u?.privateMetadata as { role?: string } | undefined)?.role;

  if (role && ADMIN_ROLES.has(role)) redirect("/admin");
  redirect("/dashboard");
}
