import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";

const schema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await ctx.params;
  return withSuperAdmin(async (actor) => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: parsed.data.status,
        resolvedAt: parsed.data.status === "OPEN" ? null : new Date(),
      },
    });
    await logAdminAction({
      actorUserId: actor.id,
      action: "report.update",
      targetType: "report",
      targetId: reportId,
      metadata: { status: parsed.data.status },
    });
    return NextResponse.json({ ok: true });
  });
}
