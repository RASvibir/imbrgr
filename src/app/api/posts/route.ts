import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { processAndStoreUpload } from "@/lib/media-save";
import { fetchFeed, type FeedSort } from "@/lib/posts";
import { getVoterKey } from "@/lib/voter";
import {
  maxBytesForMime,
  parseTags,
  postInputSchema,
  slugifyTag,
  validateUploadMime,
} from "@/lib/validation";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = (searchParams.get("sort") ?? "viral") as FeedSort;
  const cursor = searchParams.get("cursor") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const feed = await fetchFeed({ sort, cursor, tagSlug: tag });
  return NextResponse.json(feed);
}

export async function POST(req: Request) {
  const session = await auth();
  const { voterKey } = await getVoterKey();
  const form = await req.formData();
  const title = form.get("title")?.toString() ?? "";
  const description = form.get("description")?.toString();
  const tagsRaw = form.get("tags")?.toString() ?? "";
  const visibilityInput = form.get("visibility")?.toString();
  const aiGenerated = form.get("aiGenerated") === "true";
  const aiPrompt = form.get("aiPrompt")?.toString();

  const parsed = postInputSchema.safeParse({
    title,
    description: description || undefined,
    tags: parseTags(tagsRaw),
    visibility: visibilityInput,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f) => f instanceof File) as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "At least one file required" }, { status: 400 });
  }
  if (files.length > 20) {
    return NextResponse.json({ error: "Too many files" }, { status: 400 });
  }

  const visibility =
    parsed.data.visibility ?? (session?.user ? "PUBLIC" : "UNLISTED");

  try {
    const postShortId = newShortId();
    const post = await prisma.post.create({
      data: {
        shortId: postShortId,
        userId: session?.user?.id ?? null,
        title: parsed.data.title,
        description: parsed.data.description,
        visibility,
        aiGenerated,
        aiPrompt: aiPrompt || undefined,
      },
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mime = file.type || "application/octet-stream";
      if (!validateUploadMime(mime)) {
        return NextResponse.json({ error: `Unsupported type: ${mime}` }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.byteLength > maxBytesForMime(mime)) {
        return NextResponse.json({ error: "File too large" }, { status: 400 });
      }
      await processAndStoreUpload({
        buffer: buf,
        mime,
        userId: session?.user?.id ?? null,
        voterKey: session?.user ? null : voterKey,
        postId: post.id,
        sortOrder: i,
        aiGenerated,
        aiPrompt: aiPrompt || undefined,
      });
    }

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
