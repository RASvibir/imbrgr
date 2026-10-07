import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { onStandaloneMediaRestricted } from "@/lib/media-access-restrict";
import { deleteMediaStorage } from "@/lib/media-storage";
import { removeAnonymousStorage, removeUserStorage } from "@/lib/storage-quota";

const patchSchema = z.object({
  mature: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  delete: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  return withSuperAdmin(async (actor) => {
    const media = await prisma.media.findUnique({ where: { shortId } });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    if (parsed.data.delete) {
      await deleteMediaStorage(media);
      if (media.userId) await removeUserStorage(media.userId, media.byteSize);
      else if (media.voterKey) await removeAnonymousStorage(media.voterKey, media.byteSize);
      await prisma.media.delete({ where: { id: media.id } });
      await logAdminAction({
        actorUserId: actor.id,
        action: "media.delete",
        targetType: "media",
        targetId: shortId,
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    await prisma.media.update({
      where: { id: media.id },
      data: { mature: parsed.data.mature, visibility: parsed.data.visibility },
    });
    if (parsed.data.visibility === "PRIVATE") {
      await onStandaloneMediaRestricted(media.id);
    }
    await logAdminAction({
      actorUserId: actor.id,
      action: "media.moderate",
      targetType: "media",
      targetId: shortId,
      metadata: parsed.data as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  });
}
