import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api";
import { logAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { getSiteSettings, ensureSiteSettingsRow } from "@/lib/site-settings";

const patchSchema = z.object({
  anonymousUploadsEnabled: z.boolean().optional(),
  anonymousAiEnabled: z.boolean().optional(),
  anonAiDailyLimit: z.number().int().min(0).max(1000).nullable().optional(),
  announcementBanner: z.string().max(500).nullable().optional(),
});

export async function GET() {
  return withSuperAdmin(async () => {
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  });
}

export async function PATCH(req: Request) {
  return withSuperAdmin(async (actor) => {
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await ensureSiteSettingsRow();
    const data: Record<string, unknown> = {};
    if (parsed.data.anonymousUploadsEnabled !== undefined) {
      data.anonymousUploadsEnabled = parsed.data.anonymousUploadsEnabled;
    }
    if (parsed.data.anonymousAiEnabled !== undefined) {
      data.anonymousAiEnabled = parsed.data.anonymousAiEnabled;
    }
    if (parsed.data.anonAiDailyLimit !== undefined) {
      data.anonAiDailyLimit = parsed.data.anonAiDailyLimit;
    }
    if (parsed.data.announcementBanner !== undefined) {
      data.announcementBanner = parsed.data.announcementBanner;
    }
    await prisma.siteSetting.update({ where: { id: "global" }, data });
    await logAdminAction({
      actorUserId: actor.id,
      action: "settings.update",
      targetType: "site",
      targetId: "global",
      metadata: parsed.data as Record<string, unknown>,
    });
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  });
}
