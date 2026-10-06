import { NextResponse } from "next/server";
import { canViewMedia } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";
import { readLocalObject, readObject } from "@/lib/storage";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.join("/");
  const actor = await getActor(req);

  const media = await prisma.media.findFirst({
    where: { storageKey: key },
    include: { post: { select: { userId: true, visibility: true } } },
  });

  if (media && !canViewMedia(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = (await readObject(key)) ?? (await readLocalObject(key));
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mimeHint = new URL(req.url).searchParams.get("mime") ?? undefined;
  const type = contentTypeForKey(key, mimeHint);
  const isPrivate =
    media &&
    (media.post?.visibility === "PRIVATE" ||
      (!media.post && media.visibility === "PRIVATE"));

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
