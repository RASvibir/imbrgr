import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { normalizeVisibility, type Visibility } from "@/lib/visibility";

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
): Visibility {
  const vis = normalizeVisibility(requested ?? "PUBLIC");
  if (!userId && vis === "PRIVATE") return "UNLISTED";
  return vis;
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
