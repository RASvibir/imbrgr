/**
 * Idempotent thumbnail backfill for existing images.
 * Run: npx tsx scripts/backfill-thumbnails.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateImageThumbnails } from "../src/lib/thumbnails";
import { readLocalObject, readObject, deleteObject } from "../src/lib/storage";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const batch = await prisma.media.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      thumbMdKey: null,
    },
    take: 200,
    orderBy: { id: "asc" },
  });

  let done = 0;
  for (const m of batch) {
    const data = (await readObject(m.storageKey)) ?? (await readLocalObject(m.storageKey));
    if (!data) {
      console.warn("skip missing", m.shortId);
      continue;
    }
    try {
      if (m.thumbSmKey) await deleteObject(m.thumbSmKey).catch(() => {});
      if (m.thumbMdKey) await deleteObject(m.thumbMdKey).catch(() => {});
      const thumbs = await generateImageThumbnails(data);
      await prisma.media.update({
        where: { id: m.id },
        data: {
          thumbSmKey: thumbs.thumbSmKey,
          thumbMdKey: thumbs.thumbMdKey,
          placeholderCss: thumbs.placeholderCss,
        },
      });
      done++;
      console.log("thumbs", m.shortId);
    } catch (e) {
      console.error("fail", m.shortId, e);
    }
  }

  console.log(`Backfill batch complete: ${done}/${batch.length}. Re-run until batch is empty.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
