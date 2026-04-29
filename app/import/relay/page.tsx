import { requireUser } from "@/lib/auth";
import { verifyBookmarkletToken } from "@/lib/auth/bookmarklet-token";
import { RelayClient } from "./RelayClient";

// Bookmarklet relay landing page.
//
// The MyScoreIQ bookmarklet opens this URL via window.open with `?t=<token>`.
// Middleware redirects signed-out users to /sign-in?redirect_url=… so this
// component only ever renders for an authenticated session. We then verify
// the bookmarklet token here on the server (purely informational — the
// relay client posts {token, json} and the import API re-verifies for real)
// and render the client handshake component.

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
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const token = typeof params.t === "string" ? params.t : "";

  const verify = verifyBookmarkletToken(token);
  const tokenOk = verify.ok;
  const tokenError = verify.ok ? null : verify.message;
  const tokenUidMatches = verify.ok && verify.payload.uid === user.id;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <RelayClient
        token={token}
        tokenOk={tokenOk}
        tokenError={tokenError}
        tokenUidMatches={tokenUidMatches}
        userEmail={user.email}
      />
    </main>
  );
}
