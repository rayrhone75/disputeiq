import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { loadCreditReportStatus } from "@/lib/credit-import/status";

// Customer-facing status endpoint. Returns the derived credit-report
// lifecycle state for the calling user — used by the dashboard chip when
// client code wants to refresh without a full page reload.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const status = await loadCreditReportStatus(token);
  return NextResponse.json({ status });
}
