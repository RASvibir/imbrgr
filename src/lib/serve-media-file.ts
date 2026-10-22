import { canViewMedia, canViewPost } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { parseRange } from "@/lib/http-range";
import { statObject, storageDriver } from "@/lib/storage";

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

  const object = await statObject(storageKey);
  if (!object) {
    if (storageDriver() === "blob") {
      console.error(`[imbrgr/media] blob read failed for key=${storageKey}`);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const mimeHint = new URL(req.url).searchParams.get("mime") ?? undefined;
  const headers: Record<string, string> = {
    "Content-Type": contentTypeForKey(storageKey, mimeHint),
    "Cache-Control": mediaFileCacheControl(media, isProfileAsset),
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  const range = parseRange(req.headers.get("range"), object.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${object.size}` } });
  }

  const body = await object.open(range);
  if (!body) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (range) {
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${object.size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }
  return new Response(body, { status: 200, headers: { ...headers, "Content-Length": String(object.size) } });
}
