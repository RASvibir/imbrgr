import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMediaOwner } from "@/lib/media-access";
import { processAndStoreUpload, replaceMediaInPlace } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({
  mode: z.enum(["replace", "version"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const session = await auth();
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({ where: { shortId }, include: { post: true } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!media.mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Only images can be edited" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const modeRaw = form.get("mode")?.toString() ?? "replace";
  const parsed = schema.safeParse({ mode: modeRaw });
  if (!(file instanceof File) || !parsed.success) {
    return NextResponse.json({ error: "Invalid edit payload" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    if (parsed.data.mode === "replace") {
      if (!session?.user) {
        return NextResponse.json({ error: "Sign in to replace the original file" }, { status: 401 });
      }
      await replaceMediaInPlace({
        mediaId: media.id,
        userId: session.user.id,
        buffer: buf,
        mime: file.type || "image/jpeg",
      });
      return NextResponse.json({ shortId: media.shortId, mode: "replace" });
    }

    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: buf,
      mime: file.type || "image/jpeg",
      userId: actor.userId,
      voterKey: actor.userId ? null : actor.voterKey,
      parentMediaId: parentId,
      postId: media.postId ?? undefined,
      sortOrder: media.sortOrder,
      visibility: normalizeVisibility(media.visibility),
    });

    return NextResponse.json({ shortId: created.shortId, mode: "version" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Edit failed" }, { status: 400 });
  }
}
