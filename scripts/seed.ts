import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { newShortId } from "../src/lib/ids";
import { putObject } from "../src/lib/storage";
import { slugifyTag } from "../src/lib/validation";

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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect fill="#1c1816" width="100%" height="100%"/><text x="50%" y="50%" fill="#f97316" font-size="48" text-anchor="middle" font-family="sans-serif">imbrgr demo</text></svg>`;
  const buf = Buffer.from(svg);
  const key = await putObject(`seed-${newShortId()}.svg`, buf, "image/svg+xml");

  const tag = await prisma.tag.upsert({
    where: { slug: "demo" },
    create: { slug: "demo", name: "demo" },
    update: {},
  });

  await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: demo.id,
      title: "Welcome to imbrgr — images, served hot",
      description: "Seed post for local development.",
      visibility: "PUBLIC",
      score: 12,
      upvoteCount: 15,
      downvoteCount: 3,
      viewCount: 42,
      media: {
        create: {
          shortId: newShortId(),
          storageKey: key.key,
          mimeType: "image/svg+xml",
          byteSize: buf.byteLength,
          width: 800,
          height: 500,
          sortOrder: 0,
        },
      },
      tags: { create: [{ tagId: tag.id }] },
    },
  });

  const memeTag = slugifyTag("memes");
  const t2 = await prisma.tag.upsert({
    where: { slug: memeTag },
    create: { slug: memeTag, name: "memes" },
    update: {},
  });

  const buf2 = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f97316"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs><rect fill="url(#g)" width="100%" height="100%"/><text x="50%" y="50%" fill="#fff" font-size="36" text-anchor="middle">burger bytes</text></svg>`,
  );
  const key2 = await putObject(`seed-${newShortId()}.svg`, buf2, "image/svg+xml");

  await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: demo.id,
      title: "Burger bytes test upload",
      visibility: "PUBLIC",
      media: {
        create: {
          shortId: newShortId(),
          storageKey: key2.key,
          mimeType: "image/svg+xml",
          byteSize: buf2.byteLength,
          sortOrder: 0,
        },
      },
      tags: { create: [{ tagId: t2.id }] },
    },
  });

  console.log("Seeded demo user demo@imbrgr.website / password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
