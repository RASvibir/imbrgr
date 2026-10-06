import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { removeUserStorage } from "@/lib/storage-quota";

const patchSchema = z.object({
  hiddenByAdmin: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  delete: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  return withSuperAdmin(async (actor) => {
    const post = await prisma.post.findUnique({
      where: { shortId },
      include: { media: true },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    if (parsed.data.delete) {
      for (const m of post.media) {
        await deleteObject(m.storageKey);
        if (post.userId) await removeUserStorage(post.userId, m.byteSize);
      }
      await prisma.post.delete({ where: { id: post.id } });
      await logAdminAction({
        actorUserId: actor.id,
        action: "post.delete",
        targetType: "post",
        targetId: shortId,
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        hiddenByAdmin: parsed.data.hiddenByAdmin,
        visibility: parsed.data.visibility,
      },
    });
    await logAdminAction({
      actorUserId: actor.id,
      action: "post.moderate",
      targetType: "post",
      targetId: shortId,
      metadata: parsed.data as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  });
}
