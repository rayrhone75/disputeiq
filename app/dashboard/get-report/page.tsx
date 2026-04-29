import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GetReportClient } from "./GetReportClient";

// Safe-fallback get-report page.
//
// The server component does the bare minimum:
//   - Confirm a Clerk session exists (`auth()` only — no Convex, no
//     `requireUser()` mutation, no platform-settings fetch).
//   - If signed-out, redirect to /sign-in. Middleware already does this,
//     but the explicit redirect here means render never proceeds without
//     a session and we cannot 500 because of unauthenticated state.
//
// All dynamic content — credit-report status, MyScoreIQ activation
// state, bookmarklet token signing, and the card UI — lives in the
// `GetReportClient` client component. That component fetches anything
// it needs from API routes that fail soft (`/api/credit-report/status`,
// `/api/bookmarklet/token`), so a Convex blip can never crash the page.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get your credit report — DisputeIQ",
  description:
    "Guided MyScoreIQ setup for DisputeIQ — activate your monitoring, connect your 3-bureau report, and start your dispute workflow.",
};

export default async function GetReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string; imported?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/dashboard/get-report");
  }
  const params = (await searchParams) ?? {};
  const welcoming = params.welcome === "1";
  const justImported = typeof params.imported === "string" && params.imported.length > 0;

  return (
    <GetReportClient
      clerkUserId={userId}
      welcoming={welcoming}
      justImported={justImported}
    />
  );
}
