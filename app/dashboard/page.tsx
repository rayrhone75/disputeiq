import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

// Customer portal home — minimal server wrapper.
//
// Mirrors the same safe-fallback pattern we applied to /dashboard/get-report:
// the server component does only a Clerk auth check and renders a fat
// client component. All Convex-touching work moves to /api/dashboard/overview
// which fails soft. A Convex blip can never crash this page.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — DisputeIQ",
  description:
    "Track your credit-repair progress, dispute status, and next-best actions in one premium portal.",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/dashboard");
  }
  const u = await currentUser().catch(() => null);
  const firstName =
    (u?.firstName as string | null) ??
    (u?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "");
  return <DashboardClient firstName={firstName} />;
}
