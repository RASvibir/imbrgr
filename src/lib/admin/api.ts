import { NextResponse } from "next/server";
import { AdminNotFoundError, assertSuperAdminApi } from "@/lib/admin/auth";

export async function withSuperAdmin<T>(
  handler: (actor: Awaited<ReturnType<typeof assertSuperAdminApi>>) => Promise<T>,
): Promise<T | NextResponse> {
  try {
    const actor = await assertSuperAdminApi();
    return await handler(actor);
  } catch (e) {
    if (e instanceof AdminNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
