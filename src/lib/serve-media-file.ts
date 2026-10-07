import { canViewMedia, canViewPost } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { readLocalObject, readObject, storageDriver } from "@/lib/storage";

type MediaRow = {
  visibility: string;
  post: { userId: string | null; visibility: string; hiddenByAdmin: boolean } | null;
};

export function mediaFileCacheControl(media: MediaRow | null, isProfileAsset: boolean): string {
  if (isProfileAsset) {
    return "public, max-age=86400";
  }
  if (!media) {
    return "private, no-store";
  }
  const vis = media.post?.visibility ?? media.visibility;
  const isPrivate = vis === "PRIVATE" || Boolean(media.post?.hiddenByAdmin);
  if (isPrivate) {
    return "private, no-store";
  }
  // Gated route: visibility can change — do not pin with immutable public cache.
  return "public, max-age=300, must-revalidate";
}

export async function serveMediaFile(
  req: Request,
  storageKey: string,
  actor: Actor,
): Promise<Response> {
  if (storageDriver() === "blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "[imbrgr/media] STORAGE_DRIVER=blob but BLOB_READ_WRITE_TOKEN is unset; files will 404",
    );
  }

  const media = await prisma.media.findFirst({
    where: {
      OR: [{ storageKey }, { thumbSmKey: storageKey }, { thumbMdKey: storageKey }],
    },
    include: { post: { select: { userId: true, visibility: true, hiddenByAdmin: true } } },
  });

  let isProfileAsset = false;
  if (!media) {
    const profileOwner = await prisma.user.findFirst({
      where: { OR: [{ avatarKey: storageKey }, { bannerKey: storageKey }] },
      select: { id: true },
    });
    if (!profileOwner) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    isProfileAsset = true;
  }

  if (media?.post && !canViewPost(media.post, actor)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (media && !canViewMedia(media, actor)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const data = (await readObject(storageKey)) ?? (await readLocalObject(storageKey));
  if (!data) {
    if (storageDriver() === "blob") {
      console.error(`[imbrgr/media] blob read failed for key=${storageKey}`);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const mimeHint = new URL(req.url).searchParams.get("mime") ?? undefined;
  const type = contentTypeForKey(storageKey, mimeHint);

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": mediaFileCacheControl(media, isProfileAsset),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
