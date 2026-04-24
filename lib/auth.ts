// Server-side auth helpers — now backed by Clerk (no more NextAuth).
//
// Previously these returned a Prisma User row. Now they return the Clerk
// identity plus a role derived from Clerk's publicMetadata. Convex owns
// the durable `users` row; fetch/upsert it via `api.users.*` when needed.
//
// Shape is deliberately close to the old SessionUser so migration of call
// sites is mostly mechanical. The `id` field is now the Clerk user id
// (e.g. "user_2abc…"), NOT a Prisma cuid. Anything that still passes it
// into Prisma must be rewritten to query Convex instead.

import { auth, currentUser } from "@clerk/nextjs/server";

export type UserRole = "OWNER" | "ADMIN" | "SUPPORT" | "USER";

export type SessionUser = {
  /** Clerk user id — the stable subject claim. */
  id: string;
  email: string;
  role: UserRole;
  isGraceUser: boolean;
};

const VALID_ROLES: UserRole[] = ["OWNER", "ADMIN", "SUPPORT", "USER"];

function roleFromClerk(
  publicMetadata: Record<string, unknown> | undefined,
  privateMetadata: Record<string, unknown> | undefined,
): UserRole {
  const candidate =
    (publicMetadata?.role as string | undefined) ??
    (privateMetadata?.role as string | undefined);
  if (candidate && VALID_ROLES.includes(candidate as UserRole)) {
    return candidate as UserRole;
  }
  return "USER";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const u = await currentUser();
  if (!u) return null;
  const email =
    u.primaryEmailAddress?.emailAddress ??
    u.emailAddresses?.[0]?.emailAddress ??
    "";
  return {
    id: userId,
    email,
    role: roleFromClerk(
      u.publicMetadata as Record<string, unknown> | undefined,
      u.privateMetadata as Record<string, unknown> | undefined,
    ),
    isGraceUser: Boolean(
      (u.publicMetadata as { isGraceUser?: boolean } | undefined)?.isGraceUser,
    ),
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
