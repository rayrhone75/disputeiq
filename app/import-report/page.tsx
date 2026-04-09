import { redirect } from "next/navigation";

// Bridge route after the user returns from MyFreeScoreNow.
// Single canonical entry point that lands them on the upload step inside the
// authenticated dashboard. Auth middleware redirects unauthenticated users
// to sign-in, then back here.
export default function ImportReportBridge() {
  redirect("/dashboard/reports");
}
