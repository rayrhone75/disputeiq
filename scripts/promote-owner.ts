// One-shot OWNER promotion. Idempotent.
//
// Usage:
//   npm run promote:owner -- you@example.com
//
// Finds the user by email, sets role=OWNER, writes an audit log entry.
// Refuses to run without an email argument so it cannot misfire in CI.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run promote:owner -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}. Sign up first, then re-run.`);
    process.exit(2);
  }

  if (user.role === "OWNER") {
    console.log(`${email} is already OWNER. No change.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "OWNER" },
  });

  await prisma.auditLog.create({
    data: {
      targetUserId: updated.id,
      actorUserId: updated.id,
      action: "ROLE_PROMOTED_TO_OWNER",
      entityType: "User",
      entityId: updated.id,
      metadataJson: { previousRole: user.role, via: "scripts/promote-owner.ts" },
    },
  });

  console.log(`Promoted ${email} to OWNER.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(99);
  })
  .finally(() => prisma.$disconnect());
