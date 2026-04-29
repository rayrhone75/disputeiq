import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CustomersListClient } from "./CustomersListClient";

// Admin Customers list — minimal server wrapper.
//
// Middleware enforces admin role on /admin/**. The data fetch happens
// client-side against /api/admin/customers/list to keep the page
// resilient to Convex blips (same pattern as the rest of the admin
// surfaces we've moved over).

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customers — DisputeIQ Admin",
  robots: { index: false, follow: false },
};

export default async function CustomersIndexPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/admin/customers");
  }
  return <CustomersListClient />;
}
