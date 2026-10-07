import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { logAdminAction } from "@/lib/admin/audit";
import { runThumbnailBackfillBatch } from "@/lib/backfill-thumbnails-batch";

export async function POST() {
  return withSuperAdmin(async (actor) => {
    const result = await runThumbnailBackfillBatch(40);
    await logAdminAction({
      actorUserId: actor.id,
      action: "thumbnails.backfill_batch",
      targetType: "site",
      targetId: "global",
      metadata: result,
    });
    return NextResponse.json(result);
  });
}
