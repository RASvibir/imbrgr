import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processAndStoreUpload, replaceMediaInPlace } from "@/lib/media-save";

const schema = z.object({
  mode: z.enum(["replace", "version"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({ where: { shortId }, include: { post: true } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ownerId = media.userId ?? media.post?.userId;
  if (ownerId !== session.user.id) {
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
      userId: session.user.id,
      voterKey: null,
      parentMediaId: parentId,
      postId: media.postId ?? undefined,
      sortOrder: media.sortOrder,
    });

    return NextResponse.json({ shortId: created.shortId, mode: "version" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Edit failed" }, { status: 400 });
  }
}
