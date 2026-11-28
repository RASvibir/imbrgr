import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getVideoJob } from "@/lib/ai/video-job/service";
import type { JobInput, JobShot } from "@/lib/ai/video-job/types";
import { prisma } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { resolveGalleryPostVisibility } from "@/lib/gallery-visibility";
import { newShortId } from "@/lib/ids";
import { processAndStoreUpload } from "@/lib/media-save";
import { contentTypeForKey } from "@/lib/media-types";
import { getActor } from "@/lib/request-identity";
import { readObject } from "@/lib/storage";
import { postUrl } from "@/lib/urls";
import { assertUserMayUpload } from "@/lib/user-guards";
import { maxBytesForMime, parseTags, slugifyTag, validateUploadMime } from "@/lib/validation";
import { clampMatureVisibility } from "@/lib/visibility";

const publishSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(10000).optional(),
  tags: z.union([z.array(z.string().min(1).max(40)).max(20), z.string()]).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  mature: z.boolean().optional(),
});

async function resolveShotMediaBuffer(
  rawUrl: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (rawUrl.startsWith("/api/media/file/")) {
    const [pathOnly, query = ""] = rawUrl.split("?");
    const key = pathOnly
      .slice("/api/media/file/".length)
      .split("/")
      .map((s) => decodeURIComponent(s))
      .join("/");
    if (!key) return null;
    const buffer = await readObject(key);
    if (!buffer || buffer.byteLength === 0) return null;
    const mimeHint = new URLSearchParams(query).get("mime") ?? undefined;
    const mime = contentTypeForKey(key, mimeHint);
    return validateUploadMime(mime) ? { buffer, mime } : null;
  }

  const svgMatch = rawUrl.match(/^data:image\/svg\+xml(;base64|;utf8)?,(.*)$/i);
  if (svgMatch) {
    const isB64 = svgMatch[1]?.toLowerCase() === ";base64";
    const payload = svgMatch[2] ?? "";
    const decodedUtf8 = (() => {
      try {
        return decodeURIComponent(payload);
      } catch {
        // Handle inline SVGs that contain unescaped `%` (e.g. width="100%") alongside `%23` hex colors.
        return decodeURIComponent(payload.replace(/%(?![0-9a-fA-F]{2})/g, "%25"));
      }
    })();
    const svgBuf = isB64 ? Buffer.from(payload, "base64") : Buffer.from(decodedUtf8, "utf8");
    const pngBuf = await sharp(svgBuf).png().toBuffer();
    return { buffer: pngBuf, mime: "image/png" };
  }

  const dataMatch = rawUrl.match(/^data:(image\/(?:jpeg|png|gif|webp|avif));base64,(.+)$/i);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    const buffer = Buffer.from(dataMatch[2], "base64");
    return buffer.byteLength > 0 && validateUploadMime(mime) ? { buffer, mime } : null;
  }

  if (rawUrl.startsWith("https://")) {
    const res = await fetchWithTimeout(rawUrl, { timeoutMs: 20_000 });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!validateUploadMime(mime)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytesForMime(mime)) return null;
    return { buffer, mime };
  }

  return null;
}

/** Publishes a completed AI video job's shots directly to a gallery Post. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor(req);

  const uploadBlock = await assertUserMayUpload(actor.userId);
  if (uploadBlock) return NextResponse.json({ error: uploadBlock }, { status: 403 });

  const job = await getVideoJob(id, actor);
  if (!job) return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  if (job.status !== "done") {
    return NextResponse.json({ error: "Wait for video generation to finish before saving." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid publish parameters" }, { status: 400 });
  }

  const input = job.input as JobInput;
  const shots = job.shots as JobShot[];
  const resolvedMedia: { buffer: Buffer; mime: string }[] = [];
  for (const shot of shots) {
    const url = shot.videoUrl || shot.imageUrl;
    if (!url) continue;
    try {
      const item = await resolveShotMediaBuffer(url);
      if (item) resolvedMedia.push(item);
    } catch {
      // Skip unreadable shot asset; require at least one valid asset below.
    }
  }
  if (resolvedMedia.length === 0) {
    return NextResponse.json({ error: "No saveable video or frame assets found on this job." }, { status: 400 });
  }

  let userDefault: string | null = null;
  if (actor.userId) {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { defaultPostVisibility: true },
    });
    userDefault = user?.defaultPostVisibility ?? null;
  }

  const isMature = Boolean(input.mature || parsed.data.mature);
  const visibility = clampMatureVisibility(
    resolveGalleryPostVisibility(parsed.data.visibility, actor.userId, userDefault),
    isMature,
  );
  const title = parsed.data.title || (input.originalPrompt || input.prompt || "AI Video Creation").slice(0, 120);

  const post = await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: actor.userId,
      title,
      description: parsed.data.description,
      visibility,
      aiGenerated: true,
      aiPrompt: input.prompt,
    },
  });

  try {
    for (let i = 0; i < resolvedMedia.length; i++) {
      const item = resolvedMedia[i];
      await processAndStoreUpload({
        buffer: item.buffer,
        mime: item.mime,
        userId: actor.userId,
        voterKey: actor.voterKey,
        aiGenerated: true,
        aiPrompt: input.prompt,
        postId: post.id,
        sortOrder: i,
        visibility,
        mature: isMature,
      });
    }
  } catch (err) {
    await prisma.post.delete({ where: { id: post.id } }).catch(() => undefined);
    const msg = err instanceof Error ? err.message : "Failed to save video to gallery";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const rawTags = parsed.data.tags;
  const tagNames = Array.isArray(rawTags) ? rawTags : rawTags ? parseTags(rawTags) : [];
  const tagSlugs = tagNames.map(slugifyTag).filter(Boolean);
  if (tagSlugs.length > 0) {
    const tagRows = await Promise.all(
      tagSlugs.map((slug) =>
        prisma.tag.upsert({
          where: { slug },
          create: { slug, name: slug },
          update: {},
        }),
      ),
    );
    await prisma.postTag.createMany({
      data: tagRows.map((t) => ({ postId: post.id, tagId: t.id })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    shortId: post.shortId,
    pageUrl: postUrl(post.shortId),
    visibility,
    mature: isMature,
  });
}
