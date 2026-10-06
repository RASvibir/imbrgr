import { canViewMedia } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { readLocalObject, readObject, storageDriver } from "@/lib/storage";

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
    where: { storageKey },
    include: { post: { select: { userId: true, visibility: true } } },
  });

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
  const isPrivate =
    media &&
    (media.post?.visibility === "PRIVATE" ||
      (!media.post && media.visibility === "PRIVATE"));

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
