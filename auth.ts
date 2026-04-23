// Auth.js v5 configuration. Email/password (Credentials) with JWT sessions.
// Roles flow through the JWT and into `session.user.role` for RBAC.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Email + password",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;
        // Archived users have their passwordHash nulled during archive, but
        // guard explicitly so sign-in is blocked even if a row is restored
        // from backup without re-nulling the hash.
        if (user.archivedAt) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isGraceUser: user.isGraceUser,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role;
        token.isGraceUser = (user as any).isGraceUser;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid as string;
        (session.user as any).role = token.role as UserRole;
        (session.user as any).isGraceUser = !!token.isGraceUser;
      }
      return session;
    },
  },
});
