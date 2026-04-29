import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Customer360Client } from "./Customer360Client";

// Admin Customer 360 — minimal server wrapper.
//
// Auth: middleware already gates /admin behind a Clerk session AND a
// role of OWNER/ADMIN/SUPPORT (see middleware.ts), so by the time we
// reach this server component we know we have an admin. We do a
// belt-and-suspenders auth() check anyway.
//
// All data fetching happens client-side via /api/admin/customers/[id]
// — same safe-fallback pattern as the customer-facing pages.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer 360 — DisputeIQ Admin",
  robots: { index: false, follow: false },
};

export default async function Customer360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/admin/customers");
  }
  const { id } = await params;
  return <Customer360Client userId={id} />;
}
