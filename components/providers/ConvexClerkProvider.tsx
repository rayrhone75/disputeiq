"use client";

// Client bridge: Clerk issues session JWTs, Convex uses them to authorize
// queries/mutations. Placed at the app root so every downstream client
// component sees an authenticated Convex client automatically.

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // Single client per page load. Re-creating tears down Convex's socket and
  // refetches every query.
  const convex = useMemo(() => {
    if (!CONVEX_URL) return null;
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  if (!convex) {
    return <ClerkProvider>{children}</ClerkProvider>;
  }
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
