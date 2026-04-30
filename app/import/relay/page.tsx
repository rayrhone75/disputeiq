import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { verifyBookmarkletToken } from "@/lib/auth/bookmarklet-token";
import { RelayClient } from "./RelayClient";

// Bookmarklet relay landing page.
//
// The MyScoreIQ bookmarklet opens this URL via window.open with `?t=<token>`.
// Middleware redirects signed-out users; this server component is the
// belt-and-suspenders auth gate.
//
// Important: we do NOT call `requireUser()` here because that helper
// also runs a Convex `upsertFromClerk` mutation, and any blip in that
// path would 500 the relay tab — masking what's actually a working
// bookmarklet handoff with a generic error. Instead we read the Clerk
// session directly and redirect on miss; Convex doesn't get touched
// until the relay client POSTs to /api/reports/import/bookmarklet.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Importing your report — DisputeIQ",
  robots: { index: false, follow: false },
};

export default async function ImportRelayPage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    const params = (await searchParams) ?? {};
    const t =
      typeof params.t === "string" && params.t
        ? `?t=${encodeURIComponent(params.t)}`
        : "";
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/import/relay${t}`)}`,
    );
  }
  const params = (await searchParams) ?? {};
  const token = typeof params.t === "string" ? params.t : "";
  // currentUser() can occasionally fail under load; default to a sane
  // email rather than 500ing.
  const u = await currentUser().catch(() => null);
  const userEmail =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress ??
    "";

  const verify = verifyBookmarkletToken(token);
  const tokenOk = verify.ok;
  const tokenError = verify.ok ? null : verify.message;
  const tokenUidMatches = verify.ok && verify.payload.uid === userId;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <RelayClient
        token={token}
        tokenOk={tokenOk}
        tokenError={tokenError}
        tokenUidMatches={tokenUidMatches}
        userEmail={userEmail}
      />
    </main>
  );
}
