import { canViewMedia } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import { CRAWLER_ACTOR } from "@/lib/og";
import { readLocalObject, readObject } from "@/lib/storage";

/**
 * Public OG image endpoint for crawlers (Facebook, Twitter, etc.).
 * Serves bytes only when anonymous viewers may see the media (PUBLIC / UNLISTED).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { userId: true, visibility: true } } },
  });

  if (!media || !media.mimeType.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  if (!canViewMedia(media, CRAWLER_ACTOR)) {
    return new Response("Not found", { status: 404 });
  }

  const data = (await readObject(media.storageKey)) ?? (await readLocalObject(media.storageKey));
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const type = contentTypeForKey(media.storageKey, media.mimeType);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
