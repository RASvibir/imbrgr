/**
 * Remove posts with no attached media (e.g. after image deletion).
 * Usage: npx tsx scripts/cleanup-empty-posts.ts [--short-id=5iwmgap8]
 */
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const shortIdArg = process.argv.find((a) => a.startsWith("--short-id="))?.slice("--short-id=".length);

  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const where = shortIdArg
    ? { shortId: shortIdArg, media: { none: {} } }
    : { media: { none: {} } };

  const orphans = await prisma.post.findMany({
    where,
    select: { id: true, shortId: true, title: true },
  });

  if (orphans.length === 0) {
    console.log("No empty posts to remove.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  for (const p of orphans) {
    await prisma.post.delete({ where: { id: p.id } });
    console.log(`Deleted empty post ${p.shortId} (${p.title})`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
