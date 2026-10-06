import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { postInputSchema, slugifyTag } from "@/lib/validation";

const schema = postInputSchema.extend({
  mediaShortIds: z.array(z.string().min(4)).min(1).max(20),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid post data" }, { status: 400 });

  const media = await prisma.media.findMany({
    where: {
      shortId: { in: parsed.data.mediaShortIds },
      userId: session.user.id,
      postId: null,
    },
  });
  if (media.length !== parsed.data.mediaShortIds.length) {
    return NextResponse.json({ error: "Media not found or already attached" }, { status: 400 });
  }

  const aiRow = media.find((m) => m.aiGenerated);
  const postShortId = newShortId();
  const post = await prisma.post.create({
    data: {
      shortId: postShortId,
      userId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: parsed.data.visibility ?? "PUBLIC",
      aiGenerated: Boolean(aiRow),
      aiPrompt: aiRow?.aiPrompt ?? undefined,
    },
  });

  await prisma.media.updateMany({
    where: { id: { in: media.map((m) => m.id) } },
    data: { postId: post.id },
  });

  const tagSlugs = parsed.data.tags ?? [];
  const tagRows = await Promise.all(
    tagSlugs.map(async (name) => {
      const slug = slugifyTag(name);
      return prisma.tag.upsert({
        where: { slug },
        create: { slug, name },
        update: {},
      });
    }),
  );
  if (tagRows.length) {
    await prisma.postTag.createMany({
      data: tagRows.map((t) => ({ postId: post.id, tagId: t.id })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ shortId: post.shortId });
}
