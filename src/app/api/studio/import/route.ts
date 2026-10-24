import { NextResponse } from "next/server";
import {
  defaultUploadPostTitle,
  ensureGalleryPostForMedia,
} from "@/lib/ai/gallery-post";
import { uploadRateLimitPerHour } from "@/lib/config";
import { prisma } from "@/lib/db";
import { resolveGalleryPostVisibility } from "@/lib/gallery-visibility";
import { syncStudioAutoLibrarySave, parseStudioKeepOriginal } from "@/lib/library-auto-save";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { assertUserMayUpload } from "@/lib/user-guards";
import { maxBytesForMime, validateUploadMime } from "@/lib/validation";

export async function POST(req: Request) {
  const actor = await getActor(req);
  const uploadBlock = await assertUserMayUpload(actor.userId);
  if (uploadBlock) return NextResponse.json({ error: uploadBlock }, { status: 403 });
  try {
    await consumeRateLimit(`upload:${actor.userId ?? actor.ipHash}`, uploadRateLimitPerHour(), 60 * 60 * 1000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Too many uploads";
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const visibilityRaw = form.get("visibility")?.toString();
  const keepOriginal = parseStudioKeepOriginal(form.get("keepOriginal")?.toString() ?? true);
  const mature = form.get("mature") === "true" || form.get("mature") === "1";
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const mime = file.type || "application/octet-stream";
  if (!validateUploadMime(mime)) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > maxBytesForMime(mime)) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  let userDefault: string | null = null;
  if (actor.userId) {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { defaultPostVisibility: true },
    });
    userDefault = user?.defaultPostVisibility ?? null;
  }
  const { clampMatureVisibility } = await import("@/lib/visibility");
  const visibility = clampMatureVisibility(
    resolveGalleryPostVisibility(visibilityRaw, actor.userId, userDefault),
    mature,
  );

  try {
    const media = await processAndStoreUpload({
      buffer: buf,
      mime,
      userId: actor.userId,
      voterKey: actor.userId ? null : actor.voterKey,
      visibility,
      mature,
    });
    const post = await ensureGalleryPostForMedia({
      mediaId: media.id,
      userId: actor.userId,
      visibility,
      title: defaultUploadPostTitle(file.name),
      mature,
    });
    await syncStudioAutoLibrarySave(actor, media.id, keepOriginal);
    return NextResponse.json({
      shortId: media.shortId,
      postShortId: post.shortId,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      byteSize: media.byteSize,
      deleteToken: media.deleteToken,
      mature: media.mature,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 400 });
  }
}
