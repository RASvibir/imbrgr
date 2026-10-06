import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api";
import { isProtectedSuperAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

const patchSchema = z.object({
  storageQuotaBytesOverride: z.number().int().positive().nullable().optional(),
  aiDailyLimitOverride: z.number().int().positive().nullable().optional(),
  banned: z.boolean().optional(),
  suspended: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId } = await ctx.params;
  return withSuperAdmin(async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            shortId: true,
            title: true,
            visibility: true,
            hiddenByAdmin: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      banned: user.banned,
      suspended: user.suspended,
      posts: user.posts,
      storageBytesUsed: user.storageBytesUsed.toString(),
      storageQuotaBytesOverride: user.storageQuotaBytesOverride?.toString() ?? null,
    });
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId } = await ctx.params;
  return withSuperAdmin(async (actor) => {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    if (isProtectedSuperAdmin(target)) {
      if (
        parsed.data.banned === true ||
        parsed.data.suspended === true ||
        parsed.data.role !== undefined
      ) {
        return NextResponse.json({ error: "Protected super admin account" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.banned !== undefined) data.banned = parsed.data.banned;
    if (parsed.data.suspended !== undefined) data.suspended = parsed.data.suspended;
    if (parsed.data.aiDailyLimitOverride !== undefined) {
      data.aiDailyLimitOverride = parsed.data.aiDailyLimitOverride;
    }
    if (parsed.data.storageQuotaBytesOverride !== undefined) {
      data.storageQuotaBytesOverride =
        parsed.data.storageQuotaBytesOverride == null
          ? null
          : BigInt(parsed.data.storageQuotaBytesOverride);
    }
    if (parsed.data.role !== undefined && !isProtectedSuperAdmin(target)) {
      data.role = parsed.data.role;
    }

    await prisma.user.update({ where: { id: userId }, data });
    await logAdminAction({
      actorUserId: actor.id,
      action: "user.update",
      targetType: "user",
      targetId: userId,
      metadata: parsed.data as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId } = await ctx.params;
  return withSuperAdmin(async (actor) => {
    if (actor.id === userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }
    const target = await prisma.user.findUnique({
      where: { id: userId },
      include: { posts: { include: { media: true } }, mediaAssets: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isProtectedSuperAdmin(target)) {
      return NextResponse.json({ error: "Protected super admin account" }, { status: 400 });
    }

    for (const post of target.posts) {
      for (const m of post.media) await deleteObject(m.storageKey);
    }
    for (const m of target.mediaAssets) await deleteObject(m.storageKey);

    await prisma.user.delete({ where: { id: userId } });
    await logAdminAction({
      actorUserId: actor.id,
      action: "user.delete",
      targetType: "user",
      targetId: userId,
    });
    return NextResponse.json({ ok: true });
  });
}
