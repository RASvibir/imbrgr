import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not set; skipping e2e DB seed");
    return;
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
    update: { role: "USER" },
  });
  await prisma.$disconnect();
  await pool.end();
}
