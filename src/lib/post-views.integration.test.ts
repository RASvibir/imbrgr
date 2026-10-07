import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordPostView } from "@/lib/post-views";

const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

describeIfDb("recordPostView integration", () => {
  let pool: pg.Pool;
  let prisma: PrismaClient;
  let postId: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const post = await prisma.post.create({
      data: {
        shortId: `vt-${Date.now()}`,
        title: "view test",
        visibility: "PUBLIC",
        viewCount: 0,
        spiceScore: 0,
      },
    });
    postId = post.id;
  });

  afterAll(async () => {
    if (postId) {
      await prisma.post.delete({ where: { id: postId } }).catch(() => {});
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("counts one unique viewer per voterKey and stacks spice on repeats", async () => {
    const base = {
      id: postId,
      userId: "other-user",
      visibility: "PUBLIC",
      viewCount: 0,
      spiceScore: 0,
      media: [],
      createdAt: new Date(),
    };
    const visitor = { userId: null, voterKey: `a:test-${Date.now()}`, ipHash: "h" };

    const first = await recordPostView({ ...base, viewCount: 0, spiceScore: 0 }, visitor);
    expect(first.viewCount).toBe(1);
    expect(first.spiceScore).toBe(1);

    const second = await recordPostView(
      { ...base, viewCount: first.viewCount, spiceScore: first.spiceScore },
      visitor,
    );
    expect(second.viewCount).toBe(1);
    expect(second.spiceScore).toBe(2);

    const other = { userId: "u2", voterKey: "u:u2", ipHash: "h" };
    const third = await recordPostView(
      { ...base, viewCount: second.viewCount, spiceScore: second.spiceScore },
      other,
    );
    expect(third.viewCount).toBe(2);
    expect(third.spiceScore).toBe(2);
  });
});
