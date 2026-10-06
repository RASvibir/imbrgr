import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { getAdminDashboardData } from "@/lib/admin/dashboard-data";

export async function GET() {
  return withSuperAdmin(async () => NextResponse.json(await getAdminDashboardData()));
}
