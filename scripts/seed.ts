import "dotenv/config";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { prisma } from "../src/lib/db";
import { newShortId } from "../src/lib/ids";
import { deleteObject, putObject } from "../src/lib/storage";
import { slugifyTag } from "../src/lib/validation";

const SEED_POSTS = [
  {
    shortId: "seedwelcome",
    title: "Welcome to imbrgr — images, served hot",
    description: "Seed post for local development.",
    tag: "demo",
    fileKey: "seed-welcome.png",
  },
  {
    shortId: "seedburger",
    title: "Burger bytes test upload",
    description: "PNG gradient seed for gallery tests.",
    tag: "memes",
    fileKey: "seed-burger.png",
  },
] as const;

async function ensurePng(key: string, svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@imbrgr.website" },
    create: {
      email: "demo@imbrgr.website",
      username: "demo",
      passwordHash,
    },
    update: {},
  });

  const welcomeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect fill="#1c1816" width="100%" height="100%"/><text x="400" y="260" fill="#f97316" font-size="48" text-anchor="middle" font-family="sans-serif">imbrgr demo</text></svg>`;
  const burgerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f97316"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs><rect fill="url(#g)" width="100%" height="100%"/><text x="400" y="260" fill="#fff" font-size="42" text-anchor="middle" font-family="sans-serif">burger bytes</text></svg>`;

  const assets: Record<string, Buffer> = {
    "seed-welcome.png": await ensurePng("seed-welcome.png", welcomeSvg),
    "seed-burger.png": await ensurePng("seed-burger.png", burgerSvg),
  };

  for (const seed of SEED_POSTS) {
    const existing = await prisma.post.findUnique({
      where: { shortId: seed.shortId },
      include: { media: true },
    });
    if (existing) {
      for (const m of existing.media) {
        await deleteObject(m.storageKey);
      }
      await prisma.post.delete({ where: { id: existing.id } });
    }

    const buf = assets[seed.fileKey];
    const stored = await putObject(seed.fileKey, buf, "image/png");
    const slug = slugifyTag(seed.tag);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: { slug, name: seed.tag },
      update: {},
    });

    await prisma.post.create({
      data: {
        shortId: seed.shortId,
        userId: demo.id,
        title: seed.title,
        description: seed.description,
        visibility: "PUBLIC",
        score: seed.shortId === "seedwelcome" ? 12 : 0,
        upvoteCount: seed.shortId === "seedwelcome" ? 15 : 0,
        downvoteCount: seed.shortId === "seedwelcome" ? 3 : 0,
        viewCount: 42,
        media: {
          create: {
            shortId: newShortId(),
            storageKey: stored.key,
            mimeType: "image/png",
            byteSize: buf.byteLength,
            width: 800,
            height: 500,
            sortOrder: 0,
          },
        },
        tags: { create: [{ tagId: tag.id }] },
      },
    });
  }

  // Remove legacy duplicate seed posts from older runs
  await prisma.post.deleteMany({
    where: {
      shortId: { notIn: SEED_POSTS.map((s) => s.shortId) },
      title: { in: SEED_POSTS.map((s) => s.title) },
    },
  });

  console.log("Seeded demo user demo@imbrgr.website / password123");
  console.log("Posts:", SEED_POSTS.map((s) => `/p/${s.shortId}`).join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
