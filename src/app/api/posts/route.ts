import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { extForMime, imageMeta } from "@/lib/media-process";
import { fetchFeed, type FeedSort } from "@/lib/posts";
import { newStorageKey, putObject } from "@/lib/storage";
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
  const form = await req.formData();
  const title = form.get("title")?.toString() ?? "";
  const description = form.get("description")?.toString();
  const tagsRaw = form.get("tags")?.toString() ?? "";
  const visibilityInput = form.get("visibility")?.toString();

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

  const postShortId = newShortId();
  const mediaRecords: {
    shortId: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }[] = [];

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
    let width: number | null = null;
    let height: number | null = null;
    if (mime.startsWith("image/") && mime !== "image/gif") {
      try {
        const meta = await imageMeta(buf);
        width = meta.width;
        height = meta.height;
      } catch {
        /* keep null */
      }
    }
    const key = newStorageKey(extForMime(mime));
    await putObject(key, buf, mime);
    mediaRecords.push({
      shortId: newShortId(),
      storageKey: key,
      mimeType: mime,
      byteSize: buf.byteLength,
      width,
      height,
      sortOrder: i,
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

  const post = await prisma.post.create({
    data: {
      shortId: postShortId,
      userId: session?.user?.id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      visibility,
      media: { create: mediaRecords },
      tags: { create: tagRows.map((t) => ({ tagId: t.id })) },
    },
    include: { media: true },
  });

  return NextResponse.json({ shortId: post.shortId });
}
