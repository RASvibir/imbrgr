/**
 * E2E database seed — run via `npx tsx scripts/e2e-seed.ts` (not from Playwright CJS global-setup).
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const hash = await bcrypt.hash("password12345", 10);

  await prisma.user.upsert({
    where: { username: "e2eadmin" },
    create: {
      email: "e2eadmin@imbrgr.test",
      username: "e2eadmin",
      passwordHash: hash,
      role: "SUPERADMIN",
    },
    update: { role: "SUPERADMIN", banned: false, suspended: false },
  });

  await prisma.user.upsert({
    where: { username: "e2euser" },
    create: {
      email: "e2euser@imbrgr.test",
      username: "e2euser",
      passwordHash: hash,
      role: "USER",
    },
    update: { role: "USER", banned: false, suspended: false },
  });

  await prisma.aiAnonymousUsage.deleteMany({});
  await prisma.aiGenerationUsage.deleteMany({});

  await prisma.siteSetting.upsert({
    where: { id: "global" },
    create: { id: "global", updatedAt: new Date() },
    update: { updatedAt: new Date() },
  });

  await prisma.$disconnect();
  await pool.end();
  console.log("E2E seed OK: e2eadmin (SUPERADMIN), e2euser (USER)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
