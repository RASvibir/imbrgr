import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withSuperAdmin(async () => {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { username: true } } },
    });
    return NextResponse.json({ logs });
  });
}
