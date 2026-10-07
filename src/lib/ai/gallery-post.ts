import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { resolveGalleryPostVisibility } from "@/lib/gallery-visibility";
import { type Visibility } from "@/lib/visibility";

export function titleFromAiPrompt(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t) return "Studio image";
  if (t.length <= 300) return t;
  return `${t.slice(0, 297)}...`;
}

/** Default gallery visibility for AI generate unless the user picked unlisted/private. */
export function resolveAiGalleryVisibility(
  requested: string | undefined,
  userId: string | null,
  userDefault?: string | null,
): Visibility {
  return resolveGalleryPostVisibility(requested, userId, userDefault);
}

export function defaultUploadPostTitle(filename?: string | null): string {
  if (filename) {
    const base = filename.replace(/\.[^.]+$/, "").trim();
    if (base) return base.length <= 300 ? base : `${base.slice(0, 297)}...`;
  }
  return "Shared image";
}

/** Attach media to a gallery post (creates one when missing). */
export async function ensureGalleryPostForMedia(params: {
  mediaId: string;
  userId: string | null;
  visibility: Visibility;
  title?: string;
  aiGenerated?: boolean;
  aiPrompt?: string;
}) {
  const media = await prisma.media.findUnique({ where: { id: params.mediaId } });
  if (!media) throw new Error("Media not found");
  if (media.postId) {
    await prisma.post.update({
      where: { id: media.postId },
      data: { visibility: params.visibility },
    });
    await prisma.media.update({
      where: { id: media.id },
      data: { visibility: params.visibility },
    });
    const post = await prisma.post.findUnique({ where: { id: media.postId } });
    if (!post) throw new Error("Post not found");
    return post;
  }

  const post = await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: params.userId,
      title: params.title ?? defaultUploadPostTitle(),
      visibility: params.visibility,
      aiGenerated: params.aiGenerated ?? false,
      aiPrompt: params.aiPrompt,
    },
  });

  await prisma.media.update({
    where: { id: media.id },
    data: {
      postId: post.id,
      visibility: params.visibility,
    },
  });

  return post;
}

export async function createGalleryPostForAiMedia(params: {
  mediaIds: string[];
  userId: string | null;
  visibility: Visibility;
  title: string;
  aiPrompt: string;
}) {
  if (params.mediaIds.length === 0) throw new Error("No media to publish");

  const post = await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: params.userId,
      title: params.title,
      visibility: params.visibility,
      aiGenerated: true,
      aiPrompt: params.aiPrompt,
    },
  });

  await prisma.media.updateMany({
    where: { id: { in: params.mediaIds } },
    data: {
      postId: post.id,
      visibility: params.visibility,
    },
  });

  return post;
}
