import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "owner@disputeiq.local" },
    update: {},
    create: { email: "owner@disputeiq.local", role: "OWNER" },
  });
  await prisma.user.upsert({
    where: { email: "demo@disputeiq.local" },
    update: {},
    create: { email: "demo@disputeiq.local", role: "USER", isGraceUser: false },
  });
  console.log("Seeded:", owner.email);
}

main().finally(() => prisma.$disconnect());
