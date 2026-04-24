// Proof-of-stack page. Renders:
//   - Clerk <SignInButton> / <UserButton> based on auth state
//   - A Convex query result showing this user's Convex row (null until the
//     first mutation creates it)
//   - A button that calls users.upsertFromClerk so the row gets created
//
// No Prisma, no NextAuth, no app-scoped code — purely Clerk + Convex.
// If this page works end-to-end, the stack is wired correctly.

"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ConvexTestPage() {
  const { isSignedIn, user } = useUser();
  const me = useQuery(api.users.currentUser);
  const upsert = useMutation(api.users.upsertFromClerk);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Convex + Clerk — stack check</h1>
        <p className="text-sm text-slate-600">
          If you can see your Clerk email AND the Convex query returns a row after
          pressing Upsert, the stack is wired correctly.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold">Clerk</h2>
        {!isSignedIn ? (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-white">
                Sign in
              </button>
            </SignInButton>
            <span className="text-slate-500">You are signed out.</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <UserButton />
            <span>
              Signed in as{" "}
              <span className="font-mono">
                {user?.primaryEmailAddress?.emailAddress ?? user?.id}
              </span>
            </span>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold">Convex query: users.currentUser</h2>
        <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px]">
{me === undefined ? "Loading…" : JSON.stringify(me, null, 2)}
        </pre>
        {isSignedIn && (
          <button
            type="button"
            onClick={() =>
              upsert({
                email:
                  user?.primaryEmailAddress?.emailAddress ?? "unknown@example.com",
              })
            }
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Upsert my Convex user row
          </button>
        )}
      </section>

      <p className="text-xs text-slate-500">
        This route is intentionally not gated by middleware so you can view it
        signed-out too and confirm the Clerk sign-in modal works.
      </p>
    </main>
  );
}
