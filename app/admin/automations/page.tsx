import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AutomationsClient } from "./AutomationsClient";

// Admin Automations feed — minimal server wrapper.
// Middleware already gates /admin behind admin role; we belt-and-
// suspenders the auth() check.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Automations — DisputeIQ Admin",
  robots: { index: false, follow: false },
};

export default async function AutomationsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/admin/automations");
  }
  return <AutomationsClient />;
}
