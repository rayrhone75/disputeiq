// Server-side auth helpers built on Auth.js v5.
// Use these from server components, route handlers, and server actions.
import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  isGraceUser: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id) return null;
  return { id: u.id, email: u.email, role: u.role, isGraceUser: !!u.isGraceUser };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Error("FORBIDDEN");
  return u;
}

export async function loadUser(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}
