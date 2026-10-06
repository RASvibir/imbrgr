import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";

import { prisma } from "@/lib/db";

export async function GET() {
  return withSuperAdmin(async () => {
    const reports = await prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        post: { select: { shortId: true, title: true, visibility: true } },
        user: { select: { username: true } },
      },
    });
    return NextResponse.json({ reports });
  });
}
