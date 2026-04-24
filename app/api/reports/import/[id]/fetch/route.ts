import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAndCapture, ImportRunnerError } from "@/lib/credit-import/runner";
import { ProviderFetchError } from "@/lib/credit-import/fetcher";
import type { Id } from "@/convex/_generated/dataModel";

type Params = { params: Promise<{ id: string }> };

// Customer-initiated fetch. Requires the user to supply their own IdentityIQ
// session Cookie header (captured from their browser after login). The URL
// is locked to the IdentityIQ JSON endpoint pattern so users can't fetch
// arbitrary hosts through DisputeIQ's servers.
const ALLOWED_HOST_SUFFIX = ".identityiq.com";

export async function POST(req: NextRequest, ctx: Params) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const cookieHeader = typeof body.cookieHeader === "string" ? body.cookieHeader : undefined;
  if (!url || !cookieHeader) {
    return NextResponse.json(
      {
        error: "MISSING_INPUT",
        message: "Both the IdentityIQ report URL and your session cookie are required.",
      },
      { status: 400 },
    );
  }
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return NextResponse.json({ error: "BAD_URL", message: "Report URL is malformed." }, { status: 400 });
  }
  if (!host.endsWith(ALLOWED_HOST_SUFFIX)) {
    return NextResponse.json(
      {
        error: "HOST_NOT_ALLOWED",
        message: "Report URL must be an IdentityIQ address.",
      },
      { status: 400 },
    );
  }

  try {
    const updated = await fetchAndCapture(
      { token },
      {
        importId: id as Id<"creditReportImports">,
        url,
        cookieHeader,
        onlyIfOwnedByMe: true,
      },
    );
    return NextResponse.json({ import: updated });
  } catch (err) {
    if (err instanceof ProviderFetchError) {
      return NextResponse.json(
        { error: err.code, message: err.message, status: err.status },
        { status: 502 },
      );
    }
    if (err instanceof ImportRunnerError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    if ((err as Error).message === "NOT_FOUND" || (err as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL", message: (err as Error).message },
      { status: 500 },
    );
  }
}
