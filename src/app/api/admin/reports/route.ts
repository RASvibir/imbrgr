import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";

import { prisma } from "@/lib/db";
import { reportTargetLabel } from "@/lib/report-labels";

export async function GET() {
  return withSuperAdmin(async () => {
    const rows = await prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        post: { select: { shortId: true, title: true, visibility: true } },
        user: { select: { username: true } },
      },
    });
    const reports = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        targetLabel: await reportTargetLabel(r.targetType, r.targetId),
      })),
    );
    return NextResponse.json({ reports });
  });
}
