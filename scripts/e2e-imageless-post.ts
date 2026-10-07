import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { newShortId } from "../src/lib/ids";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const shortId = newShortId();
  await prisma.post.create({
    data: {
      shortId,
      title: `imageless ${Date.now()}`,
      visibility: "PUBLIC",
    },
  });
  await prisma.$disconnect();
  await pool.end();
  process.stdout.write(shortId);
}

void main();
